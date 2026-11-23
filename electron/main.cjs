const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// --- File-based JSON storage ---
const dbDir = path.join(app.getPath('userData'), 'db');

function ensureDbDir() {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function getFilePath(key) {
  // sanitize key for filename
  return path.join(dbDir, key.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
}

ipcMain.handle('store-get', (_event, key) => {
  ensureDbDir();
  const filePath = getFilePath(key);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (e) {
    console.error('store-get error:', e);
  }
  return null;
});

ipcMain.handle('store-set', (_event, key, value) => {
  ensureDbDir();
  const filePath = getFilePath(key);
  try {
    fs.writeFileSync(filePath, value, 'utf-8');
    return true;
  } catch (e) {
    console.error('store-set error:', e);
    return false;
  }
});

ipcMain.handle('store-remove', (_event, key) => {
  ensureDbDir();
  const filePath = getFilePath(key);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (e) {
    console.error('store-remove error:', e);
    return false;
  }
});

// --- Window ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, '..', 'dist', 'favicon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: true,
    title: 'Karachi Cloth Center POS',
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
