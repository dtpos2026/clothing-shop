const { contextBridge, ipcRenderer } = require('electron');
// Preload is sandboxed (Electron ≥20): only 'electron' may be required here.
const info = ipcRenderer.sendSync('app-info') || {};

contextBridge.exposeInMainWorld('electronStore', {
  getItem: (key) => ipcRenderer.invoke('store-get', key),
  setItem: (key, value) => ipcRenderer.invoke('store-set', key, value),
  removeItem: (key) => ipcRenderer.invoke('store-remove', key),
});

contextBridge.exposeInMainWorld('electronAPI', {
  hostname: info.hostname || 'desktop',
  platform: info.platform || 'win32',
  version: info.version || '',
  saveFile: (opts) => ipcRenderer.invoke('file-save', opts),
  writeAppFile: (rel, data) => ipcRenderer.invoke('file-write-app', rel, data),
  readAppFile: (rel) => ipcRenderer.invoke('file-read-app', rel),
  listAppFiles: (rel) => ipcRenderer.invoke('file-list-app', rel),
  revealFile: (p) => ipcRenderer.invoke('file-reveal', p),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  printHtml: (opts) => ipcRenderer.invoke('print-html', opts),
  listPrinters: () => ipcRenderer.invoke('list-printers'),
});
