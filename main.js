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

const API_BASE = 'https://coversehq.com';

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

const MEDIA_ALLOWED_PERMISSIONS = new Set([
  'media',
  'camera',
  'microphone',
  'display-capture',
  'speaker-selection',
  'mediaKeySystem',
  'geolocation',
  'notifications',
  'fullscreen',
  'pointerLock'
]);

function isAllowedPermission(permission) {
  return MEDIA_ALLOWED_PERMISSIONS.has(String(permission || ''));
}

function applyPermissionHandlers(targetSession) {
  if (!targetSession) return;

  targetSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(isAllowedPermission(permission));
  });

  targetSession.setPermissionCheckHandler((_webContents, permission) => {
    return isAllowedPermission(permission);
  });
}

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

// Add Chromium stability flag while keeping GPU enabled for smoother media/call performance.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

if (process.env.COVERSE_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  console.warn('[main] GPU acceleration disabled via COVERSE_DISABLE_GPU=1');
}

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

  const restoreMainUiAfterCheckout = () => {
    const currentUrl = String(mainWindow?.webContents?.getURL?.() || '');
    if (!currentUrl) return;
    if (!currentUrl.includes('stripe.com')) return;

    if (localServer) {
      const appUrl = localServer.getUrl('pages/app.html');
      mainWindow.loadURL(appUrl).catch(() => {});
      return;
    }

    mainWindow.loadFile(path.join(__dirname, 'pages', 'app.html')).catch(() => {});
  };

  const interceptProtocolNavigation = (event, targetUrl) => {
    const url = String(targetUrl || '');
    if (!url.startsWith('coverse://')) return false;

    event.preventDefault();
    handleProtocolUrl(url);

    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      restoreMainUiAfterCheckout();
    }

    return true;
  };

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
  mainWindow.webContents.on('will-navigate', (event, url) => {
    interceptProtocolNavigation(event, url);
  });
  mainWindow.webContents.on('will-redirect', (event, url) => {
    interceptProtocolNavigation(event, url);
  });

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Enable WebRTC screen capture
  applyPermissionHandlers(mainWindow.webContents.session);

  // Handle display media (screen share) request
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      if (sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' });
        return;
      }
      callback({ video: null, audio: null });
    }).catch(() => {
      callback({ video: null, audio: null });
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
      const handled = interceptProtocolNavigation(event, url);
      if (handled && !childWindow.isDestroyed()) {
        childWindow.close();
      }
    });

    childWindow.webContents.on('will-redirect', (event, url) => {
      console.log('[main] OAuth popup will-redirect:', url);
      const handled = interceptProtocolNavigation(event, url);
      if (handled && !childWindow.isDestroyed()) {
        childWindow.close();
      }
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

ipcMain.handle('stripe:getPublishableKey', async () => {
  const res = await fetch(`${API_BASE}/api/stripe-config`);
  if (!res.ok) throw new Error('Failed to load stripe config');
  const data = await res.json();
  if (!data?.publishableKey) throw new Error('Missing publishableKey');
  return data.publishableKey;
});

ipcMain.handle('stripe:createCheckoutSession', async (_event, payload = {}) => {
  const requestHeaders = {
    'Content-Type': 'application/json'
  };

  if (payload?.authToken) {
    requestHeaders.Authorization = `Bearer ${payload.authToken}`;
  }

  const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`create-checkout-session failed (${res.status})`);
  return res.json();
});

ipcMain.handle('stripe:confirmPayment', async (_event, payload = {}) => {
  const requestHeaders = {
    'Content-Type': 'application/json'
  };

  if (payload?.authToken) {
    requestHeaders.Authorization = `Bearer ${payload.authToken}`;
  }

  const sessionId = payload?.sessionId || '';
  const res = await fetch(`${API_BASE}/api/confirm-payment`, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({ sessionId })
  });
  if (!res.ok) throw new Error(`confirm-payment failed (${res.status})`);
  return res.json();
});

// ============================================
// PROTOCOL HANDLING FOR STRIPE REDIRECTS
// ============================================

// Register custom protocol for deep linking (coverse://)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('coverse', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('coverse');
}

const startupProtocolUrl = process.argv.find((arg) => String(arg || '').startsWith('coverse://')) || '';
const allowMultiInstance = process.env.COVERSE_ALLOW_MULTI_INSTANCE === '1';

if (allowMultiInstance) {
  console.warn('[main] Single-instance lock disabled via COVERSE_ALLOW_MULTI_INSTANCE=1');
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });
} else {
  // Single instance lock to handle protocol URLs
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine) => {
      // Handle protocol URLs on Windows
      const url = commandLine.find(arg => arg.startsWith('coverse://'));
      if (url) {
        handleProtocolUrl(url);
      }

      // Focus the main window
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    // Handle protocol URLs on macOS
    app.on('open-url', (event, url) => {
      event.preventDefault();
      handleProtocolUrl(url);
    });
  }
}

function handleProtocolUrl(url) {
  console.log('[Protocol] Received URL:', url);
  
  if (!url || !url.startsWith('coverse://')) return;

  try {
    const urlObj = new URL(url);
    const route = `${urlObj.hostname}${urlObj.pathname}`.replace(/^\/+|\/+$/g, '');
    const params = Object.fromEntries(urlObj.searchParams);
    const sessionId = params.session_id || '';

    if (route === 'checkout' && sessionId) {
      console.log('[Protocol] Checkout return:', sessionId);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('checkout-success', { sessionId });
        
        // Show notification
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Payment Successful',
          message: 'Your purchase was completed successfully!',
          buttons: ['OK']
        });
      }
      return;
    }

    // Handle Stripe checkout success
    if (route === 'checkout-success') {
      console.log('[Protocol] Checkout success:', sessionId);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('checkout-success', { sessionId });
        
        // Show notification
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Payment Successful',
          message: 'Your purchase was completed successfully!',
          buttons: ['OK']
        });
      }
      return;
    }

    // Handle Stripe checkout cancel
    if (route === 'checkout-cancel') {
      console.log('[Protocol] Checkout cancelled');
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('checkout-cancel');
        
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Payment Cancelled',
          message: 'Your payment was cancelled. You can try again anytime.',
          buttons: ['OK']
        });
      }
    }
  } catch (error) {
    console.error('[Protocol] Failed to parse URL:', error);
  }
}

app.whenReady().then(() => {
  // Configure the persist:coverse session for webview/siteWindow
  const coverseSession = session.fromPartition('persist:coverse');
  
  // Set permissions for the webview session
  applyPermissionHandlers(coverseSession);
  
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
  if (startupProtocolUrl) {
    setTimeout(() => handleProtocolUrl(startupProtocolUrl), 300);
  }
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
