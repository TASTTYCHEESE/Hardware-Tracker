const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hwt', {
  platform: 'desktop',
  fetchText: (url) => ipcRenderer.invoke('fetch-text', url),
  readRecaps: () => ipcRenderer.invoke('read-recaps'),
  importRecaps: () => ipcRenderer.invoke('import-recaps'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (patch) => ipcRenderer.invoke('set-settings', patch),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  archiveArticles: (list) => ipcRenderer.invoke('archive-articles', list),
  listArchiveDays: () => ipcRenderer.invoke('list-archive-days'),
  readArchiveDay: (day) => ipcRenderer.invoke('read-archive-day', day),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  appInfo: () => ipcRenderer.invoke('app-info'),
  checkForUpdates: () => ipcRenderer.invoke('check-updates'),
  updateInfo: () => ipcRenderer.invoke('update-info'),
  restartToUpdate: () => ipcRenderer.invoke('update-restart'),
  onUpdateStatus: (cb) => {
    const h = (_e, info) => cb(info);
    ipcRenderer.on('update-status', h);
    return () => ipcRenderer.removeListener('update-status', h);
  },
  syncNow: () => ipcRenderer.invoke('sync-now'),
  saveImage: (dataUrl, name) => ipcRenderer.invoke('save-image', dataUrl, name),
  catalogIndex: (force) => ipcRenderer.invoke('catalog-index', force),
  catalogCategory: (id) => ipcRenderer.invoke('catalog-category', id),
  onNavigate: (cb) => {
    const h = (_e, target) => cb(target);
    ipcRenderer.on('navigate', h);
    return () => ipcRenderer.removeListener('navigate', h);
  },
  onHistory: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('history', h);
    return () => ipcRenderer.removeListener('history', h);
  },
  onDataChanged: (cb) => {
    const h = () => cb();
    ipcRenderer.on('data-changed', h);
    return () => ipcRenderer.removeListener('data-changed', h);
  },
});
