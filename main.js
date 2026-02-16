if (process.env.ELECTRON_RUN_AS_NODE === '1') {
  console.error('ELECTRON_RUN_AS_NODE is set. Please unset it to run the Electron app.');
  process.exit(1);
}

const { app, BrowserWindow, BrowserView, Tray, Menu, ipcMain, desktopCapturer, shell, session, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs/promises');
const AdmZip = require('adm-zip');
let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (_error) {
  autoUpdater = null;
}
const WebSocketServer = require('./src/websocket-server');
const LocalServer = require('./src/local-server');
const config = require('./config');
const NativeHelper = require('./src/native-helper');
const { createUpdateManager } = require('./src/update-manager');

let mainWindow;
let tray;
let wsServer;
let localServer;
const nativeHelper = new NativeHelper(config);
let siteWindow = null;
let siteView = null;
let siteViewVisible = false;
const MAX_RELOADS = 3;
let reloadAttempts = 0;
let updateManager = null;

function sendUpdateStatus(payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('coverse-update', payload);
  } catch (_error) {
    // no-op
  }
}

function showUpdateNotice(title, message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title,
    message
  }).catch(() => {});
}

function openInSystemBrowser(targetUrl) {
  if (!targetUrl) return Promise.resolve(false);
  const escapedUrl = String(targetUrl).replace(/"/g, '\\"');

  return new Promise((resolve) => {
    let command = '';
    if (process.platform === 'win32') {
      command = `start "" "${escapedUrl}"`;
    } else if (process.platform === 'darwin') {
      command = `open "${escapedUrl}"`;
    } else {
      command = `xdg-open "${escapedUrl}"`;
    }

    exec(command, (error) => {
      if (!error) {
        resolve(true);
        return;
      }
      shell.openExternal(targetUrl)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    });
  });
}

// Optional per-instance user data/cache path (helps avoid black window collisions)
if (process.env.ELECTRON_USER_DATA_DIR) {
  app.setPath('userData', process.env.ELECTRON_USER_DATA_DIR);
}

// Disable hardware acceleration to prevent BrowserView crashes
// CoverseHQ's WebGL/canvas usage conflicts with some GPU drivers in Electron's multi-process model
app.disableHardwareAcceleration();

// Add Chromium flags to improve stability
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Allow multiple app instances (handy for local loopback tests); no single-instance lock

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Coverse',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: true
    },
    backgroundColor: '#0d0d0d',
    show: true
  });

  // Load the website or local UI
  const coverseUrl = process.env.COVERSE_REMOTE_URL || 'https://coversehq.com?electron=true';
  const devUrl = process.env.COVERSE_DEV_URL || null; // e.g., http://localhost:8080 when running http-server
  // Default to local UI unless COVERSE_REMOTE=1 is set
  const forceLocal = process.env.COVERSE_FORCE_LOCAL === '1' || process.env.COVERSE_REMOTE !== '1';

  // Load via local HTTP server when in local mode (required for Google OAuth)
  const loadLocal = async () => {
    if (!localServer) {
      localServer = new LocalServer(__dirname, 0);
      await localServer.start();
    }
    const loginUrl = localServer.getUrl('pages/login.html');
    console.log('[main] Loading local UI via:', loginUrl);
    mainWindow.loadURL(loginUrl);
  };
  const loadRemote = () => mainWindow.loadURL(coverseUrl);

  if (forceLocal || config.useLocalUi) {
    loadLocal().catch(err => {
      console.error('[main] Failed to start local server:', err);
      mainWindow.loadFile(path.join(__dirname, 'pages', 'login.html'));
    });
  } else if (devUrl) {
    mainWindow.loadURL(devUrl).catch(() => loadLocal());
  } else {
    loadRemote();
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  // Safety: if nothing painted in 3s, try loading local UI
  setTimeout(() => {
    if (mainWindow && mainWindow.webContents && mainWindow.webContents.getURL().startsWith('about:blank')) {
      loadLocal();
    }
  }, 3000);

  mainWindow.webContents.on('did-fail-load', () => {
    if (!config.useLocalUi) {
      console.warn('Failed to load remote site, falling back to local UI');
      mainWindow.loadFile(path.join(__dirname, 'pages', 'login.html'));
    }
  });

  const resetReloads = () => {
    reloadAttempts = 0;
    try {
      mainWindow.webContents.send('coverse-status', { state: 'ready' });
    } catch (_) {}
  };

  const reloadWithBackoff = () => {
    if (reloadAttempts >= MAX_RELOADS) {
      console.warn('Max reload attempts reached for main webContents');
      return;
    }
    reloadAttempts += 1;
    const delay = 500 * reloadAttempts;
    try {
      mainWindow.webContents.send('coverse-status', { state: 'retry', attempt: reloadAttempts });
    } catch (_) {}
    setTimeout(() => {
      if (!mainWindow?.webContents?.isDestroyed()) {
        mainWindow.webContents.reload();
      }
    }, delay);
  };

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.warn('[main] render-process-gone', details?.reason);
    reloadWithBackoff();
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[main] webContents unresponsive, reloading');
    reloadWithBackoff();
  });

  mainWindow.webContents.on('did-finish-load', resetReloads);

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Enable WebRTC screen capture
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'fullscreen', 'pointerLock'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle display media (screen share) request
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      if (sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
      }
    });
  });

  // Handle popups - allow Google OAuth in Electron windows, others to external browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    const url = details.url || '';
    console.log('[main] Popup requested:', url, 'features:', details.features, 'frameName:', details.frameName);
    
    // Allow Google OAuth and Firebase auth popups to open in Electron
    // Also allow about:blank which Firebase uses initially
    if (url.includes('accounts.google.com') || 
        url.includes('firebaseapp.com') ||
        url.includes('googleapis.com') ||
        url.includes('google.com/signin') ||
        url === 'about:blank' ||
        url === '' ||
        details.frameName?.includes('firebase')) {
      console.log('[main] Allowing popup for auth');
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 700,
          parent: mainWindow,
          modal: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // Share session with main window
            session: mainWindow.webContents.session
          }
        }
      };
    }
    
    // Route other popups to external browser
    console.log('[main] Redirecting popup to external browser');
    openInSystemBrowser(details.url);
    return { action: 'deny' };
  });

  // Track OAuth popup windows - log navigation for debugging
  mainWindow.webContents.on('did-create-window', (childWindow) => {
    console.log('[main] Child window created');
    
    childWindow.webContents.on('will-navigate', (event, url) => {
      console.log('[main] OAuth popup will-navigate:', url);
    });
    
    childWindow.webContents.on('did-navigate', (event, url) => {
      console.log('[main] OAuth popup did-navigate:', url);
      // Only close if the auth flow completed and page shows success
      // Don't close prematurely - let Firebase handle it via postMessage
    });

    childWindow.webContents.on('did-finish-load', () => {
      console.log('[main] OAuth popup finished loading');
    });
  });

  // Strip frame-blocking headers for coversehq.com so it can embed in webview/iframe
  const ses = mainWindow.webContents.session;
  const filter = { urls: ['https://coversehq.com/*', 'https://*.coversehq.com/*'] };
  ses.webRequest.onHeadersReceived(filter, (details, callback) => {
    const headers = { ...(details.responseHeaders || {}) };
    // Remove X-Frame-Options
    Object.keys(headers)
      .filter((k) => k.toLowerCase() === 'x-frame-options')
      .forEach((k) => delete headers[k]);
    // Strip frame-ancestors from CSP
    const cspKey = Object.keys(headers).find((k) => k.toLowerCase() === 'content-security-policy');
    if (cspKey && Array.isArray(headers[cspKey])) {
      const cleaned = headers[cspKey]
        .map((h) => h.replace(/frame-ancestors[^;]*;?/gi, ''))
        .join('; ');
      headers[cspKey] = [cleaned];
    }
    callback({ responseHeaders: headers });
  });
}

// Create and manage embedded BrowserView for CoverseHQ
function createSiteView() {
  if (siteView) return siteView;
  
  try {
    const { BrowserView } = require('electron');
    
    siteView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: true
      }
    });
    
    mainWindow.addBrowserView(siteView);
    
    // Set initial bounds
    updateSiteViewBounds();
    
    // Load CoverseHQ
    siteView.webContents.loadURL('https://coversehq.com/?electron=1');
    
    // Debug logging
    siteView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('BrowserView failed to load:', errorCode, errorDescription);
    });
    
    siteView.webContents.on('did-finish-load', () => {
      console.log('BrowserView loaded successfully');
    });
    
    // Handle resize
    mainWindow.on('resize', updateSiteViewBounds);
    
    // Send status
    mainWindow.webContents.send('site-view-status', { visible: true, embedded: true });
    
    return siteView;
  } catch (err) {
    console.error('Failed to create BrowserView:', err);
    // Fallback to external browser
    openSiteExternal();
    return null;
  }
}

function updateSiteViewBounds() {
  if (!siteView || !mainWindow) return;
  
  const bounds = mainWindow.getContentBounds();
  // Position below the top nav (56px) and fill the content area
  siteView.setBounds({
    x: 0,
    y: 56,
    width: bounds.width,
    height: bounds.height - 56
  });
}

function openSiteExternal() {
  openInSystemBrowser('https://coversehq.com/?electron=1');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('site-view-status', { external: true });
  }
}

function openSiteWindow() {
  createSiteView();
  showSiteView();
}

function showSiteView() {
  if (!siteView) {
    createSiteView();
  }
  if (siteView && mainWindow) {
    mainWindow.addBrowserView(siteView);
    updateSiteViewBounds();
    siteViewVisible = true;
    mainWindow.webContents.send('site-view-status', { visible: true, embedded: true });
  }
}

function hideSiteView() {
  if (siteView && mainWindow) {
    mainWindow.removeBrowserView(siteView);
    siteViewVisible = false;
    mainWindow.webContents.send('site-view-status', { visible: false });
  }
}

function toggleSiteView(show) {
  if (show) {
    showSiteView();
  } else {
    hideSiteView();
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open Coverse', 
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Check for Updates',
      click: () => {
        if (updateManager) {
          updateManager.checkForUpdates({ manual: true, source: 'tray' });
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Coverse');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function createAppMenu() {
  const template = [
    {
      label: 'Coverse',
      submenu: [
        {
          label: `Version ${app.getVersion()}`,
          enabled: false
        },
        {
          label: 'Check for Updates',
          click: () => {
            if (updateManager) {
              updateManager.checkForUpdates({ manual: true, source: 'app-menu' });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for renderer communication
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ 
    types: ['screen', 'window'],
    thumbnailSize: { width: 150, height: 150 }
  });
  return sources.map(source => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});

ipcMain.handle('config:get', () => ({
  protocolVersion: config.protocolVersion,
  signaling: config.signaling,
  helper: config.helper,
  storage: config.storage,
  useLocalUi: config.useLocalUi
}));

ipcMain.handle('helper:runtime', () => nativeHelper.runtimeInfo());
ipcMain.handle('helper:start-control', (_event, targetWindowId) => nativeHelper.startControl(targetWindowId));
ipcMain.handle('helper:stop-control', () => nativeHelper.stopControl());
ipcMain.handle('helper:set-target', (_event, windowId) => nativeHelper.setTargetWindow(windowId));
ipcMain.handle('helper:focus-state', () => nativeHelper.getFocusState());
ipcMain.handle('open-external', async (_event, url) => openInSystemBrowser(url));
ipcMain.handle('library:save-file', async (_event, payload = {}) => {
  try {
    const defaultPath = payload.defaultName ? path.basename(String(payload.defaultName)) : 'download';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Downloaded File',
      defaultPath,
      buttonLabel: 'Save'
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    const rawData = payload.data;
    if (!rawData) {
      return { ok: false, error: 'Missing file data' };
    }

    const buffer = Buffer.isBuffer(rawData)
      ? rawData
      : rawData instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(rawData))
        : ArrayBuffer.isView(rawData)
          ? Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength)
          : Buffer.from(rawData);

    await fs.writeFile(result.filePath, buffer);
    return { ok: true, filePath: result.filePath };
  } catch (error) {
    return { ok: false, error: error?.message || 'Failed to save file' };
  }
});
ipcMain.handle('library:save-file-from-url', async (_event, payload = {}) => {
  try {
    const sourceUrl = String(payload.url || '');
    if (!sourceUrl) {
      return { ok: false, error: 'Missing URL' };
    }

    const defaultPath = payload.defaultName ? path.basename(String(payload.defaultName)) : 'download';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Downloaded File',
      defaultPath,
      buttonLabel: 'Save'
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return { ok: false, error: `Download failed (${response.status})` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(result.filePath, buffer);
    return { ok: true, filePath: result.filePath };
  } catch (error) {
    return { ok: false, error: error?.message || 'Failed to download and save file' };
  }
});
ipcMain.handle('library:fetch-blob-from-url', async (_event, payload = {}) => {
  try {
    const sourceUrl = String(payload.url || '');
    if (!sourceUrl) {
      return { ok: false, error: 'Missing URL' };
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return { ok: false, error: `Fetch failed (${response.status})` };
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      ok: true,
      contentType,
      dataBase64: buffer.toString('base64')
    };
  } catch (error) {
    return { ok: false, error: error?.message || 'Failed to fetch blob from URL' };
  }
});
ipcMain.handle('library:list-zip-entries', async (_event, payload = {}) => {
  try {
    let zipBuffer = null;

    if (payload.dataBase64) {
      zipBuffer = Buffer.from(String(payload.dataBase64), 'base64');
    } else if (payload.url) {
      const sourceUrl = String(payload.url || '');
      if (!sourceUrl) return { ok: false, error: 'Missing URL' };
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        return { ok: false, error: `Download failed (${response.status})` };
      }
      zipBuffer = Buffer.from(await response.arrayBuffer());
    }

    if (!zipBuffer || !zipBuffer.length) {
      return { ok: false, error: 'No ZIP data available' };
    }

    const zip = new AdmZip(zipBuffer);
    const allEntries = zip.getEntries() || [];
    const normalizedEntries = allEntries.map((entry) => ({
      name: entry.entryName || '',
      isDirectory: !!entry.isDirectory,
      size: Number(entry.header?.size || 0),
      compressedSize: Number(entry.compressedSize || 0)
    }));

    return {
      ok: true,
      total: normalizedEntries.length,
      entries: normalizedEntries.slice(0, 300)
    };
  } catch (error) {
    return { ok: false, error: error?.message || 'Could not inspect ZIP archive' };
  }
});
ipcMain.handle('auth:external-login-url', async () => {
  if (!localServer) {
    localServer = new LocalServer(__dirname, 0);
    await localServer.start();
  }
  const loginUrl = localServer.getUrl('pages/login.html');
  const callbackUrl = localServer.getAuthCallbackUrl();
  if (!loginUrl || !callbackUrl) return null;
  return `${loginUrl}?external=1&callback=${encodeURIComponent(callbackUrl)}`;
});
ipcMain.handle('auth:consume-callback', () => {
  if (!localServer) return null;
  return localServer.consumeExternalAuth();
});

ipcMain.handle('site:open-window', () => {
  showSiteView();
});
ipcMain.handle('app:check-for-updates', async () => {
  if (!updateManager) return { ok: false, error: 'Update manager not initialized.' };
  return updateManager.checkForUpdates({ manual: true, source: 'renderer' });
});
ipcMain.handle('app:install-update', async () => {
  if (!updateManager) return { ok: false, error: 'Update manager not initialized.' };
  return updateManager.installAndRestart();
});
ipcMain.handle('app:update-remind-later', async () => {
  if (!updateManager) return { ok: false, error: 'Update manager not initialized.' };
  return updateManager.remindLater();
});
ipcMain.on('site:show', () => {
  showSiteView();
});
ipcMain.on('site:hide', () => {
  hideSiteView();
});

ipcMain.on('vst-message', (event, message) => {
  if (wsServer) {
    wsServer.broadcast(message);
  }
});

app.whenReady().then(() => {
  // Configure the persist:coverse session for webview/siteWindow
  const coverseSession = session.fromPartition('persist:coverse');
  
  // Set permissions for the webview session
  coverseSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'fullscreen', 'pointerLock'];
    callback(allowedPermissions.includes(permission));
  });
  
  // Strip frame-blocking headers for coversehq.com in webview session
  const filter = { urls: ['https://coversehq.com/*', 'https://*.coversehq.com/*'] };
  coverseSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const headers = { ...(details.responseHeaders || {}) };
    Object.keys(headers)
      .filter((k) => k.toLowerCase() === 'x-frame-options')
      .forEach((k) => delete headers[k]);
    const cspKey = Object.keys(headers).find((k) => k.toLowerCase() === 'content-security-policy');
    if (cspKey && Array.isArray(headers[cspKey])) {
      const cleaned = headers[cspKey]
        .map((h) => h.replace(/frame-ancestors[^;]*;?/gi, ''))
        .join('; ');
      headers[cspKey] = [cleaned];
    }
    callback({ responseHeaders: headers });
  });
  
  createWindow();
  updateManager = createUpdateManager({
    app,
    autoUpdater,
    sendStatus: sendUpdateStatus,
    menuNotify: showUpdateNotice
  });
  createTray();
  createAppMenu();
  updateManager.start();
  
  // Start WebSocket server for VST communication
  if (process.env.COVERSE_SKIP_WSS !== '1') {
    const wsPort = parseInt(process.env.COVERSE_WSS_PORT || '5181', 10);
    try {
      wsServer = new WebSocketServer(wsPort);
      wsServer.onMessage = (message) => {
        if (mainWindow) {
          mainWindow.webContents.send('vst-message', message);
        }
      };
      console.log('Coverse started');
      console.log(`WebSocket server running on ws://localhost:${wsPort}`);
    } catch (err) {
      console.error('[WSS] Failed to start WebSocket server:', err);
    }
  } else {
    console.log('Coverse started (WSS disabled via COVERSE_SKIP_WSS=1)');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Don't quit, minimize to tray
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (updateManager) {
    updateManager.dispose();
    updateManager = null;
  }
  if (wsServer) {
    wsServer.close();
  }
  if (localServer) {
    localServer.stop();
  }
});
