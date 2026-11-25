// Hardware Tracker — Electron main process.
// The UI (src/) is plain React so the same code can later run in a browser or a
// Capacitor phone app; everything desktop-specific lives here and in preload.cjs.
const { app, BrowserWindow, ipcMain, dialog, Notification, net, shell, Tray, Menu, nativeImage } = require('electron');
const background = require('./background.cjs');
const updater = require('./updater.cjs');
const catalogMod = require('./catalog.cjs');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

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
let catalog;
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
  app.setLoginItemSettings({ openAtLogin: s.startWithWindows !== false && app.isPackaged, openAsHidden: true, args: ['--hidden'] });
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
    { label: 'PC Hardware', click: () => showWindow('hardware') },
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
  // Mouse back / forward buttons on Windows (the renderer also listens for them; it ignores duplicates).
  win.on('app-command', (_e, cmd) => {
    if (cmd === 'browser-backward') win.webContents.send('history', -1);
    if (cmd === 'browser-forward') win.webContents.send('history', 1);
  });
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
    // Articles may only go to web pages, never file:// or other schemes.
    const webOnly = (e, url) => {
      if (!/^https?:\/\//i.test(url)) e.preventDefault();
    };
    contents.on('will-navigate', webOnly);
    contents.on('will-redirect', webOnly);
    contents.on('will-frame-navigate', (e) => webOnly(e, e.url));
    // Pop-ups from articles open in the normal browser.
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
  });
  // The window only ever shows the app itself: not other files on this computer, not web pages.
  const appUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;
  win.webContents.on('will-navigate', (e, url) => {
    if (url.split('#')[0] !== appUrl && !(devUrl && url.startsWith(devUrl))) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });
}

// ---- IPC -------------------------------------------------------------------

const MAX_FETCH = 15 * 1024 * 1024;
// Security: the window may only ask for public web pages, never this computer or the home
// network (router admin pages, local servers), even when a page or feed links there.
function isLocalAddress(u) {
  let host;
  try {
    host = new URL(u).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return true;
  }
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.home.arpa')) return true;
  if (!host.includes('.') && !host.includes(':')) return true; // single-word names on the local network
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return true; // numeric tricks like http://2130706433/
  if (host.includes(':')) return host === '::' || host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('::ffff:');
  return false;
}

ipcMain.handle('fetch-text', async (_e, url) => {
  if (typeof url !== 'string' || url.length > 4000 || !/^https?:\/\//i.test(url)) throw new Error('Bad URL');
  if (isLocalAddress(url)) throw new Error('Local addresses are blocked');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await net.fetch(url, {
      headers: { 'User-Agent': `HardwareTracker/${app.getVersion()} (+desktop app)` },
      signal: ctrl.signal,
      credentials: 'omit',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!/^https?:/i.test(res.url || url) || isLocalAddress(res.url || url)) throw new Error('Bad redirect');
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_FETCH) throw new Error('Too large');
    const text = await res.text();
    if (text.length > MAX_FETCH) throw new Error('Too large');
    return text;
  } finally {
    clearTimeout(timer);
  }
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

const MAIN_ONLY_SETTINGS = new Set(['updateUrl']);
ipcMain.handle('set-settings', async (_e, patch) => {
  // Only plain settings objects; never prototype keys.
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Bad settings');
  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    // The update server can only be changed by editing settings.json by hand, never from the
    // window: a page that took over the window could otherwise point updates at its own installer.
    if (MAIN_ONLY_SETTINGS.has(k)) continue;
    clean[k] = v;
  }
  if ('dataDir' in clean && clean.dataDir && (typeof clean.dataDir !== 'string' || !path.isAbsolute(clean.dataDir))) throw new Error('Bad folder');
  for (const k of ['catalogUrl', 'syncUrl']) if (clean[k] && (typeof clean[k] !== 'string' || !/^https?:\/\//i.test(clean[k]))) throw new Error('Bad URL');
  patch = clean;
  const next = { ...readSettings(), ...patch };
  writeSettings(next);
  if ('dataDir' in patch) {
    seedRecaps();
    watchDataDir();
  }
  if ('startWithWindows' in patch) applyLoginItem();
  if ('autoInstallUpdates' in patch && upd) upd.applySettings();
  return { ...next, dataDir: dataDir() };
});

ipcMain.handle('choose-folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('open-folder', async () => shell.openPath(dataDir()));
// "Save as image": the renderer draws the element to a PNG; ask where to save it.
ipcMain.handle('save-image', async (e, dataUrl, name) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w || typeof dataUrl !== 'string' || dataUrl.length > 60e6 || !dataUrl.startsWith('data:image/png;base64,')) return { ok: false };
  const safe = String(name || 'hardware-tracker').replace(/[^\w\- ]+/g, '').trim().slice(0, 80) || 'hardware-tracker';
  const res = await dialog.showSaveDialog(w, {
    title: 'Save as image',
    defaultPath: require('node:path').join(app.getPath('pictures'), `${safe}.png`),
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false };
  require('node:fs').writeFileSync(res.filePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return { ok: true, path: res.filePath };
});

ipcMain.handle('app-info', async () => ({ version: app.getVersion(), updateStatus: upd ? upd.status() : '' }));
ipcMain.handle('check-updates', async () => (upd ? upd.check() : null));
ipcMain.handle('update-info', async () => (upd ? upd.info() : null));
ipcMain.handle('update-restart', async () => (upd ? upd.restart() : false));
ipcMain.handle('sync-now', async () => {
  const r = await bg.sync();
  if (r.added) notifyRenderer();
  return r;
});

ipcMain.handle('catalog-index', async (_e, force) => catalog.index(!!force));
ipcMain.handle('catalog-category', async (_e, id) => catalog.category(String(id)));

ipcMain.handle('notify', async (_e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

app.setAppUserModelId('app.hardwaretracker.desktop');

// Only one copy runs; starting it again just opens the window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  // Mac: clicking the Dock icon brings the window back.
  app.on('activate', () => showWindow());
  // Security: web pages (including articles in the viewer) get no camera, microphone,
  // location, notifications or other permissions, and can't open new app windows.
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
  });
  app.whenReady().then(() => {
    const { session } = require('electron');
    for (const ses of [session.defaultSession]) {
      ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
      ses.setPermissionCheckHandler(() => false);
    }
    app.on('session-created', (ses) => {
      ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
      ses.setPermissionCheckHandler(() => false);
    });
    seedRecaps();
    watchDataDir();
    applyLoginItem();
    createTray();
    catalog = catalogMod.create({ readSettings, patchSettings, dataDir });
    bg = background.start({
      catalog,
      readSettings,
      patchSettings,
      recapsDir,
      showWindow,
      isWindowVisible,
      onRecapsChanged: notifyRenderer,
    });
    upd = updater.setup({
      readSettings,
      showWindow,
      onChange: (info) => win && !win.isDestroyed() && win.webContents.send('update-status', info),
      beforeRestart: () => {
        quitting = true;
      },
    });
    // Started by Windows at login: stay in the tray until needed.
    const hidden = process.argv.includes('--hidden') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAsHidden);
    if (!hidden) createWindow();
  });
  app.on('before-quit', () => {
    quitting = true;
  });
  // Keep running in the tray when the window is closed.
  app.on('window-all-closed', () => {
    if (readSettings().closeToTray === false) app.quit();
  });
}
