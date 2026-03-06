const { contextBridge, ipcRenderer } = require('electron');

let cachedToken = null;

contextBridge.exposeInMainWorld('coverse', {
  // Config and version
  getConfig: () => ipcRenderer.invoke('config:get'),
  
  // Get available screen sources for sharing
  getSources: () => ipcRenderer.invoke('get-sources'),
  
  // VST communication
  sendToVST: (message) => ipcRenderer.send('vst-message', message),
  onVSTMessage: (callback) => {
    ipcRenderer.on('vst-message', (event, message) => callback(message));
  },
  
  // App info
  isElectron: true,
  platform: process.platform,
  
  // Window controls (if using frameless window)
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Native helper bridge (stubbed until helper is installed)
  helper: {
    runtime: () => ipcRenderer.invoke('helper:runtime'),
    startControl: (targetWindowId) => ipcRenderer.invoke('helper:start-control', targetWindowId),
    stopControl: () => ipcRenderer.invoke('helper:stop-control'),
    setTargetWindow: (windowId) => ipcRenderer.invoke('helper:set-target', windowId),
    getFocusState: () => ipcRenderer.invoke('helper:focus-state')
  },

  // CoverseHQ embedded view (BrowserView)
  openSiteWindow: () => ipcRenderer.invoke('site:open-window'),
  showSiteView: () => ipcRenderer.send('site:show'),
  hideSiteView: () => ipcRenderer.send('site:hide'),
  onSiteViewStatus: (callback) => {
    ipcRenderer.on('site-view-status', (_event, status) => callback(status));
  },
  // Legacy alias
  onSiteWindowStatus: (callback) => {
    ipcRenderer.on('site-view-status', (_event, status) => callback(status));
  },
  
  // External URLs
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  saveLibraryFile: (payload) => ipcRenderer.invoke('library:save-file', payload),
  saveLibraryFileFromUrl: (payload) => ipcRenderer.invoke('library:save-file-from-url', payload),
  fetchLibraryBlobFromUrl: (payload) => ipcRenderer.invoke('library:fetch-blob-from-url', payload),
  listZipEntries: (payload) => ipcRenderer.invoke('library:list-zip-entries', payload),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  remindUpdateLater: () => ipcRenderer.invoke('app:update-remind-later'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('coverse-update', (_event, payload) => callback(payload));
  },

  // Stripe checkout events
  onCheckoutSuccess: (callback) => {
    ipcRenderer.on('checkout-success', (_event, data) => callback(data));
  },
  onCheckoutCancel: (callback) => {
    ipcRenderer.on('checkout-cancel', () => callback());
  },

  // External browser auth bridge
  getExternalLoginUrl: () => ipcRenderer.invoke('auth:external-login-url'),
  consumeExternalAuth: () => ipcRenderer.invoke('auth:consume-callback')
});

contextBridge.exposeInMainWorld('stripeBridge', {
  getPublishableKey: () => ipcRenderer.invoke('stripe:getPublishableKey'),
  createCheckoutSession: (payload) => ipcRenderer.invoke('stripe:createCheckoutSession', payload),
  confirmPayment: (sessionId, authToken) => ipcRenderer.invoke('stripe:confirmPayment', { sessionId, authToken })
});

// Token/status bridge for auth
contextBridge.exposeInMainWorld('coverseBridge', {
  saveToken: (token) => { cachedToken = token || null; },
  getToken: () => cachedToken,
  onStatus: (cb) => ipcRenderer.on('coverse-status', (_e, payload) => cb(payload))
});

// Listen for auth tokens from CoverseHQ window via postMessage
window.addEventListener('message', (event) => {
  if (event?.data?.type === 'coverse-auth-token' && event.data.token) {
    cachedToken = event.data.token;
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Coverse Electron app loaded');
});
