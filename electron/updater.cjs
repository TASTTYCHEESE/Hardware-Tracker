// Auto-updates via electron-updater (installer build only).
// Updates come from GitHub Releases once the repo exists (see package.json "publish"),
// or from a custom URL in settings.updateUrl (a folder with latest.yml + installer).
const { app, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

let status = 'Not checked yet';

function setup(readSettings) {
  if (!app.isPackaged || process.platform !== 'win32') {
    status = 'Auto-updates work in the installed Windows app';
    return { check: async () => status, status: () => status };
  }
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    status = 'Updater not available in this build';
    return { check: async () => status, status: () => status };
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Feed: settings.updateUrl, e.g. https://github.com/<you>/hardware-tracker/releases/latest/download
  // (GitHub serves latest.yml + the installer there). Until it's set, updates stay off.
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
  status = 'Auto-updates work in the installed version (HardwareTracker-Setup.exe)';

  autoUpdater.on('checking-for-update', () => (status = 'Checking for updates…'));
  autoUpdater.on('update-not-available', () => (status = `Up to date (version ${app.getVersion()})`));
  autoUpdater.on('download-progress', (p) => (status = `Downloading update… ${Math.round(p.percent)}%`));
  autoUpdater.on('error', (e) => (status = `Update check failed: ${String(e && e.message ? e.message : e).split('\n')[0].slice(0, 140)}`));
  autoUpdater.on('update-downloaded', (info) => {
    status = `Version ${info.version} is ready and will install when you close the app`;
    if (Notification.isSupported()) new Notification({ title: 'Hardware Tracker update ready', body: `Version ${info.version} installs when you quit the app.` }).show();
  });

  const check = async () => {
    if (!ensureFeed()) return (status = 'Auto-updates work in the installed version (HardwareTracker-Setup.exe)');
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      status = `Update check failed: ${String(e && e.message ? e.message : e).split('\n')[0].slice(0, 140)}`;
    }
    return status;
  };
  setTimeout(check, 60e3);
  setInterval(check, 6 * 3600e3);
  return { check, status: () => status };
}

module.exports = { setup };
