// Hardware Tracker — Electron main process.
// The UI (src/) is plain React so the same code can later run in a browser or a
// Capacitor phone app; everything desktop-specific lives here and in preload.cjs.
const { app, BrowserWindow, ipcMain, dialog, Notification, net, shell, Tray, Menu, nativeImage } = require('electron');
const background = require('./background.cjs');
const updater = require('./updater.cjs');
const path = require('node:path');
const fs = require('node:fs');

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

function defaultDataDir() {
  return path.join(app.getPath('documents'), 'Hardware Tracker');
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(s) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(s, null, 2));
}

function patchSettings(patch) {
  writeSettings({ ...readSettings(), ...patch });
}

function dataDir() {
  const dir = readSettings().dataDir || defaultDataDir();
  fs.mkdirSync(path.join(dir, 'recaps'), { recursive: true });
  return dir;
}

let win = null;
let tray = null;
let watcher;
let bg;
let upd;
let quitting = false;
let pendingTarget = null;

const recapsDir = () => path.join(dataDir(), 'recaps');

// First run: put the bundled catch-up report into the recap folder so background
// jobs (notifications, price targets) see the same data as the window.
function seedRecaps() {
  const src = path.join(__dirname, 'seed');
  try {
    for (const f of fs.readdirSync(src)) {
      const dest = path.join(recapsDir(), f);
      if (!fs.existsSync(dest)) fs.copyFileSync(path.join(src, f), dest);
    }
  } catch {
    /* no seed folder */
  }
}

/** Show (or re-create) the window, optionally jumping to a page. */
function showWindow(target) {
  if (target) pendingTarget = target;
  if (!win || win.isDestroyed()) createWindow();
  else {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (pendingTarget) {
      win.webContents.send('navigate', pendingTarget);
      pendingTarget = null;
    }
  }
}
const isWindowVisible = () => !!(win && !win.isDestroyed() && win.isVisible() && !win.isMinimized());

function applyLoginItem() {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return;
  const s = readSettings();
  app.setLoginItemSettings({ openAtLogin: s.startWithWindows !== false && app.isPackaged, args: ['--hidden'] });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Hardware Tracker');
  const menu = Menu.buildFromTemplate([
    { label: 'Open Hardware Tracker', click: () => showWindow('today') },
    { label: 'Today', click: () => showWindow('today') },
    { label: 'Prices', click: () => showWindow('prices') },
    { label: 'Tracking', click: () => showWindow('tracking') },
    { type: 'separator' },
    { label: 'Check for new recaps now', click: async () => { const r = await bg.sync(); if (r.added) notifyRenderer(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showWindow());
}

const notifyRenderer = () => win && !win.isDestroyed() && win.webContents.send('data-changed');

function watchDataDir() {
  if (watcher) watcher.close();
  try {
    let timer;
    watcher = fs.watch(path.join(dataDir(), 'recaps'), () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        notifyRenderer();
        if (bg) bg.recapsChanged();
      }, 500);
    });
  } catch {
    /* folder may be on a drive that does not support watching */
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0e1116',
    title: 'Hardware Tracker',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      webviewTag: true, // in-app article viewer
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-finish-load', () => {
    if (pendingTarget) {
      win.webContents.send('navigate', pendingTarget);
      pendingTarget = null;
    }
  });
  // Closing the window keeps the app in the tray. The window itself is destroyed,
  // which frees the renderer (most of the memory); background jobs keep running.
  win.on('close', (e) => {
    if (quitting || readSettings().closeToTray === false) return;
    if (!readSettings().trayHintShown && Notification.isSupported()) {
      new Notification({ title: 'Hardware Tracker is still running', body: 'It stays in the tray to deliver recaps and price alerts. Right-click the tray icon to quit.' }).show();
      patchSettings({ trayHintShown: true });
    }
    e.preventDefault();
    win.destroy();
    win = null;
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // Open external links in the user's normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Lock down the article <webview>: no preload, no Node, only http(s) pages.
  win.webContents.on('will-attach-webview', (e, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    if (!/^https?:\/\//.test(params.src)) e.preventDefault();
  });
  win.webContents.on('did-attach-webview', (_e, contents) => {
    // Pop-ups from articles open in the normal browser.
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !(devUrl && url.startsWith(devUrl))) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });
}

// ---- IPC -------------------------------------------------------------------

ipcMain.handle('fetch-text', async (_e, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new Error('Bad URL');
  const res = await net.fetch(url, {
    headers: { 'User-Agent': 'HardwareTracker/0.1 (+desktop app)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
});

ipcMain.handle('read-recaps', async () => {
  const dir = path.join(dataDir(), 'recaps');
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
    } catch {
      /* skip broken file */
    }
  }
  return out;
});

ipcMain.handle('import-recaps', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Import recap files',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Recap JSON', extensions: ['json'] }],
  });
  if (r.canceled) return 0;
  const dir = path.join(dataDir(), 'recaps');
  let n = 0;
  for (const f of r.filePaths) {
    try {
      JSON.parse(fs.readFileSync(f, 'utf8'));
      fs.copyFileSync(f, path.join(dir, path.basename(f)));
      n++;
    } catch {
      /* not valid JSON, skip */
    }
  }
  return n;
});

// ---- News archive: every headline the app sees is kept per day -----------
const newsDir = () => {
  const d = path.join(dataDir(), 'news');
  fs.mkdirSync(d, { recursive: true });
  return d;
};
const dayOf = (ts) => {
  const d = ts ? new Date(ts) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const readDay = (day) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(newsDir(), `${day}.json`), 'utf8'));
  } catch {
    return [];
  }
};

ipcMain.handle('archive-articles', async (_e, articles) => {
  if (!Array.isArray(articles)) return;
  const byDay = new Map();
  for (const a of articles) {
    if (!a || !a.id) continue;
    const day = dayOf(a.date);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(a);
  }
  for (const [day, list] of byDay) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const existing = readDay(day);
    const ids = new Set(existing.map((a) => a.id));
    const merged = existing.concat(list.filter((a) => !ids.has(a.id))).slice(-600);
    fs.writeFileSync(path.join(newsDir(), `${day}.json`), JSON.stringify(merged));
  }
});

ipcMain.handle('list-archive-days', async () =>
  fs.readdirSync(newsDir()).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map((n) => n.slice(0, 10)).sort().reverse(),
);

ipcMain.handle('read-archive-day', async (_e, day) => (/^\d{4}-\d{2}-\d{2}$/.test(day) ? readDay(day) : []));

ipcMain.handle('get-settings', async () => ({ ...readSettings(), dataDir: dataDir() }));

ipcMain.handle('set-settings', async (_e, patch) => {
  const next = { ...readSettings(), ...patch };
  writeSettings(next);
  if ('dataDir' in patch) {
    seedRecaps();
    watchDataDir();
  }
  if ('startWithWindows' in patch) applyLoginItem();
  return { ...next, dataDir: dataDir() };
});

ipcMain.handle('choose-folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('open-folder', async () => shell.openPath(dataDir()));

ipcMain.handle('app-info', async () => ({ version: app.getVersion(), updateStatus: upd ? upd.status() : '' }));
ipcMain.handle('check-updates', async () => (upd ? upd.check() : 'Updater not ready'));
ipcMain.handle('sync-now', async () => {
  const r = await bg.sync();
  if (r.added) notifyRenderer();
  return r;
});

ipcMain.handle('notify', async (_e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

app.setAppUserModelId('app.hardwaretracker.desktop');

// Only one copy runs; starting it again just opens the window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(() => {
    seedRecaps();
    watchDataDir();
    applyLoginItem();
    createTray();
    bg = background.start({
      readSettings,
      patchSettings,
      recapsDir,
      showWindow,
      isWindowVisible,
      onRecapsChanged: notifyRenderer,
    });
    upd = updater.setup(readSettings);
    // Started by Windows at login: stay in the tray until needed.
    if (!process.argv.includes('--hidden')) createWindow();
  });
  app.on('before-quit', () => {
    quitting = true;
  });
  // Keep running in the tray when the window is closed.
  app.on('window-all-closed', () => {
    if (readSettings().closeToTray === false) app.quit();
  });
}
