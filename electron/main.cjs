const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
      const raw = fs.readFileSync(filePath, 'utf-8');
      try { JSON.parse(raw); return raw; } catch (_) {
        // corrupted main file – fall back to the previous good copy
        if (fs.existsSync(filePath + '.bak')) return fs.readFileSync(filePath + '.bak', 'utf-8');
        return raw;
      }
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
    // write-then-rename so a power cut can never leave a half-written database
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, value, 'utf-8');
    if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
    fs.renameSync(tmp, filePath);
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

ipcMain.on('app-info', (e) => {
  e.returnValue = { hostname: os.hostname(), platform: process.platform, version: app.getVersion() };
});

// --- Files (save dialog, app data area, reveal) ---
const appFilesDir = path.join(app.getPath('userData'), 'files');

/** Resolve a relative path inside the app files dir; refuses traversal outside it. */
function appFilePath(rel) {
  const target = path.resolve(appFilesDir, String(rel || ''));
  if (target !== appFilesDir && !target.startsWith(appFilesDir + path.sep)) throw new Error('Invalid path');
  return target;
}

ipcMain.handle('file-save', async (_e, { defaultName, data, filters }) => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), String(defaultName || 'export')),
    filters: filters && filters.length ? filters : undefined,
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, Buffer.from(data));
  return filePath;
});

ipcMain.handle('file-write-app', (_e, rel, data) => {
  const target = appFilePath(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(data));
  return target;
});

ipcMain.handle('file-read-app', (_e, rel) => {
  const target = appFilePath(rel);
  return fs.existsSync(target) ? new Uint8Array(fs.readFileSync(target)) : null;
});

ipcMain.handle('file-list-app', (_e, relDir) => {
  const dir = appFilePath(relDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map(name => {
    const st = fs.statSync(path.join(dir, name));
    return { name, size: st.size, mtime: st.mtimeMs };
  }).filter(f => f.size >= 0);
});

ipcMain.handle('file-reveal', (_e, p) => {
  if (typeof p === 'string' && fs.existsSync(p)) shell.showItemInFolder(p);
});

ipcMain.handle('open-external', (_e, url) => {
  // Only web and WhatsApp links – never file:// or arbitrary protocols
  if (typeof url === 'string' && /^(https:\/\/|whatsapp:\/\/)/i.test(url)) return shell.openExternal(url);
});

// --- Printing (thermal 58/80 mm, A4/A5; optional silent print to a named printer) ---
ipcMain.handle('list-printers', async () => {
  const win = mainWindow || BrowserWindow.getAllWindows()[0];
  if (!win) return [];
  const list = await win.webContents.getPrintersAsync();
  return list.map(p => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault }));
});

ipcMain.handle('print-html', async (_e, { html, silent, deviceName, pageWidthMm, pageHeightMm, landscape }) => {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    // let images decode
    await new Promise(r => setTimeout(r, 250));
    let height = pageHeightMm;
    if (!height) {
      // thermal roll: measure content height
      const px = await win.webContents.executeJavaScript('document.body.scrollHeight', true).catch(() => 1200);
      height = Math.max(50, Math.ceil(px * 0.2646) + 6);
    }
    const options = {
      silent: !!silent,
      printBackground: true,
      deviceName: deviceName || undefined,
      landscape: !!landscape,
      margins: { marginType: pageHeightMm ? 'default' : 'none' },
      pageSize: { width: Math.round(pageWidthMm * 1000), height: Math.round(height * 1000) },
    };
    return await new Promise(resolve => {
      win.webContents.print(options, (success, failureReason) => resolve({ ok: success, error: success ? undefined : failureReason }));
    });
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    setTimeout(() => { if (!win.isDestroyed()) win.destroy(); }, 1000);
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
    title: 'Digital Target Fabric POS',
  });

  // Legacy sticker/receipt code opens about:blank print windows; allow those, send real links to the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url === '') return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// One instance only – two windows writing the same JSON store could lose data.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(createWindow);
}

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
