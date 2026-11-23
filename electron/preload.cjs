const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronStore', {
  getItem: (key) => ipcRenderer.invoke('store-get', key),
  setItem: (key, value) => ipcRenderer.invoke('store-set', key, value),
  removeItem: (key) => ipcRenderer.invoke('store-remove', key),
});
