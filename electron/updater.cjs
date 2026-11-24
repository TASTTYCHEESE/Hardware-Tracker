// Auto-updates via electron-updater (installer build only).
// Updates come from GitHub Releases (package.json "publish"), or from a custom URL
// in settings.updateUrl (a folder with latest.yml + installer).
//
// settings.autoInstallUpdates (default true):
//   true  -> a downloaded update installs by itself the next time the app quits
//   false -> it waits until the user clicks "Restart and update" in Settings > Updates
const { app, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

function setup({ readSettings, onChange, showWindow, beforeRestart }) {
  /** Everything the Updates page shows. */
  const info = {
    state: 'idle', // idle | checking | none | downloading | ready | error | unsupported
    current: app.getVersion(),
    version: '', // available / downloaded version
    releaseName: '',
    releaseDate: '',
    notes: '', // release notes of the new version (HTML or Markdown)
    percent: 0,
    message: 'Not checked yet',
    lastCheck: 0,
  };
  const set = (patch) => {
    Object.assign(info, patch);
    onChange?.({ ...info });
  };
  const api = (extra) => ({ check: async () => ({ ...info }), status: () => info.message, info: () => ({ ...info }), restart: () => false, applySettings() {}, ...extra });

  // Windows installer and Linux AppImage update themselves. Mac apps can only install updates when they're
  // signed with a paid Apple certificate, so on Mac we only check and offer the download.
  const mac = process.platform === 'darwin';
  const supported = process.platform === 'win32' || mac || (process.platform === 'linux' && !!process.env.APPIMAGE);
  if (!app.isPackaged || !supported) {
    set({
      state: 'unsupported',
      message: process.platform === 'linux' ? 'Auto-updates work in the AppImage version. Get new versions from the Releases page.' : 'Auto-updates work in the installed app',
    });
    return api();
  }
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    set({ state: 'unsupported', message: 'Updater not available in this build' });
    return api();
  }
  autoUpdater.autoDownload = !mac;
  const applySettings = () => {
    autoUpdater.autoInstallOnAppQuit = readSettings().autoInstallUpdates !== false;
  };
  applySettings();

  const feed = () => (readSettings().updateUrl || '').trim();
  let feedSet = '';
  const ensureFeed = () => {
    const url = feed();
    // Installer builds from GitHub Actions carry app-update.yml pointing at GitHub Releases.
    if (!/^https:\/\//.test(url)) return fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
    if (url !== feedSet) {
      autoUpdater.setFeedURL({ provider: 'generic', url });
      feedSet = url;
    }
    return true;
  };

  const notesOf = (u) => {
    const n = u.releaseNotes;
    if (!n) return '';
    if (typeof n === 'string') return n;
    // Array of { version, note } when several versions were skipped.
    return n.map((x) => `<h4>Version ${x.version}</h4>${x.note || ''}`).join('');
  };
  const fromInfo = (u) => ({
    version: u.version,
    releaseName: u.releaseName || '',
    releaseDate: u.releaseDate || '',
    notes: notesOf(u),
  });
  const errMsg = (e) => String(e && e.message ? e.message : e).split('\n')[0].slice(0, 160);

  autoUpdater.on('checking-for-update', () => set({ state: info.state === 'ready' ? 'ready' : 'checking', message: 'Checking for updates…' }));
  autoUpdater.on('update-not-available', () =>
    set({ state: 'none', message: `You're up to date (version ${info.current})`, lastCheck: Date.now() }),
  );
  autoUpdater.on('update-available', (u) =>
    mac
      ? set({ ...fromInfo(u), state: 'available', percent: 0, message: `Version ${u.version} is out. Download it and drag it into Applications.`, lastCheck: Date.now() })
      : set({ ...fromInfo(u), state: 'downloading', percent: 0, message: `Downloading version ${u.version}…`, lastCheck: Date.now() }),
  );
  autoUpdater.on('download-progress', (p) =>
    set({ state: 'downloading', percent: Math.round(p.percent), message: `Downloading version ${info.version}… ${Math.round(p.percent)}%` }),
  );
  autoUpdater.on('error', (e) => {
    // Keep a finished download usable even if a later check fails.
    if (info.state === 'ready') return;
    set({ state: 'error', message: `Update check failed: ${errMsg(e)}`, lastCheck: Date.now() });
  });
  let notified = '';
  autoUpdater.on('update-downloaded', (u) => {
    const auto = readSettings().autoInstallUpdates !== false;
    set({
      ...fromInfo(u),
      state: 'ready',
      percent: 100,
      message: auto ? `Version ${u.version} is ready. It installs when you quit the app, or restart now.` : `Version ${u.version} is ready. Restart the app to install it.`,
    });
    if (notified !== u.version && readSettings().notify !== false && Notification.isSupported()) {
      notified = u.version;
      const n = new Notification({
        title: `Hardware Tracker ${u.version} is ready`,
        body: auto ? 'It installs the next time you quit. Click to see what\'s new or restart now.' : 'Click to see what\'s new and restart to update.',
      });
      n.on('click', () => showWindow?.('updates'));
      n.show();
    }
  });

  const check = async () => {
    if (!ensureFeed()) {
      set({ state: 'unsupported', message: 'Auto-updates work in the installed version' });
      return { ...info };
    }
    if (info.state === 'downloading') return { ...info };
    if (info.state === 'available') set({ state: 'checking' });
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      if (info.state !== 'ready') set({ state: 'error', message: `Update check failed: ${errMsg(e)}`, lastCheck: Date.now() });
    }
    return { ...info };
  };

  /** Quit, install the downloaded update silently and start the app again. */
  const restart = () => {
    if (info.state !== 'ready') return false;
    beforeRestart?.();
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
    return true;
  };

  setTimeout(check, 60e3);
  setInterval(check, 6 * 3600e3);
  return { check, status: () => info.message, info: () => ({ ...info }), restart, applySettings };
}

module.exports = { setup };
