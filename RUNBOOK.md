# CoverseStandalone Maintenance Runbook

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Process (main.js)                    │
│  • Creates mainWindow (local UI)                            │
│  • Creates siteWindow (dedicated CoverseHQ window)          │
│  • Manages IPC, tray, WebSocket server                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
     ┌────────────┴────────────┐
     ▼                         ▼
┌─────────────────┐    ┌──────────────────────────────────────┐
│   mainWindow    │    │       siteWindow / iframe            │
│  (index.html)   │    │   (coversehq.com)                    │
│                 │    │                                      │
│  • Local UI     │    │  • Firebase auth → Electron JWT      │
│  • Call controls│    │  • electron-bridge.js handles flow   │
│  • renderer.js  │    │  • partition: persist:coverse        │
│                 │    │                                      │
│  ◄──────────────┼────│  postMessage({ type: 'coverse-auth', │
│  Receives JWT   │    │    action: 'login', token, user })   │
└─────────────────┘    └──────────────────────────────────────┘
```

### Authentication Flow

1. User logs in via Firebase on CoverseHQ
2. `electron-bridge.js` detects Electron context (`?electron=1`)
3. Calls `POST /api/electron/token` with Firebase ID token
4. Backend verifies Firebase, issues 7-day Electron JWT
5. `postMessage` sends JWT to Electron parent window
6. Electron stores JWT in `localStorage.coverseIdToken`
7. All API calls use JWT via `Authorization: Bearer` header

### Why Electron JWT?

Firebase Auth uses third-party cookies that get blocked in iframe contexts. The Electron JWT:
- Is issued server-side after Firebase verification
- Works in any context (iframe, popup, dedicated window)
- Lasts 7 days without requiring Firebase cookie access
- Backend validates via `requireUserOrElectron()` middleware

---

## Common Issues & Fixes

### Issue: "Signout received via postMessage" spam in console

**Root Cause**: Legacy signout messages from embedded frames when Firebase auth fails.

**Fix Applied**: Legacy `coverse-signout` messages are ignored. New `electron-bridge.js` uses `{ type: 'coverse-auth', action: 'logout' }` format which is properly handled.

```javascript
// renderer.js - legacy signout messages ignored
if (data.type === 'coverse-signout') {
  console.debug('Ignored legacy coverse-signout postMessage');
  return;
}
```

### Issue: Grey/blank screen after login (FIXED with backend changes)

**Root Cause**: Firebase auth failing in embedded context → page reloads → auth fails again → loop.

**Fix Applied**: Backend now issues Electron JWT via `/api/electron/token`. The `electron-bridge.js` on CoverseHQ frontend handles the flow and sends the JWT to Electron via postMessage. Embedding now works!

### Issue: "DOMException: play() request interrupted"

**Root Cause**: Video elements calling `play()` during page navigation/reload.

**Fix Applied**: Global unhandledrejection handler ignores these benign warnings:

```javascript
window.addEventListener('unhandledrejection', (event) => {
  if (event?.reason?.message?.includes('play() request was interrupted')) {
    event.preventDefault();
  }
});
```

### Issue: Buttons not responding / no visual feedback

**Fix Applied**: Added proper hover/active/focus states to launcher buttons in `styles.css`.

---

## Debugging Guide

### Check Auth State

Open DevTools in mainWindow (Ctrl+Shift+I) and run:

```javascript
// Check stored token (Electron JWT)
localStorage.getItem('coverseIdToken')

// Verify token is valid
await verifyElectronToken()

// Check auth variables
authUser
authProfile
```

### Check siteWindow Auth

1. Open the dedicated CoverseHQ window ("Open in app window")
2. Open DevTools in that window
3. Check Firebase auth: `firebase.auth().currentUser`
4. Check if electron-bridge sent token: Look for `[electron-bridge]` logs

### Verify Electron JWT

```javascript
// In Electron DevTools
const token = localStorage.getItem('coverseIdToken');
fetch('https://coversehq.com/api/electron/verify', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
```

### Force Clear Auth

```javascript
localStorage.removeItem('coverseIdToken');
authProfile = null;
authUser = null;
updateAuthUI();
```

### Check Partition Storage

The siteWindow uses `partition: 'persist:coverse'`. To inspect:

1. Navigate to: `%APPDATA%\coverse\Partitions\persist:coverse`
2. Contains: Cookies, Local Storage, IndexedDB for CoverseHQ

### Enable Verbose Logging

Set environment variable before running:
```powershell
$env:ELECTRON_ENABLE_LOGGING = 1
npm start
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COVERSE_API_BASE` | `https://coversehq.com` | Backend API base URL |
| `COVERSE_REMOTE` | `0` | Set to `1` to load remote site in mainWindow (not recommended) |
| `COVERSE_FORCE_LOCAL` | `1` | Force local UI in mainWindow |
| `COVERSE_SKIP_WSS` | `0` | Set to `1` to disable WebSocket server |
| `COVERSE_WSS_PORT` | `5181` | WebSocket server port |
| `COVERSE_UPDATE_URL` | (empty) | Generic update feed URL for `electron-updater` (folder that serves `latest.yml` + installer artifacts) |
| `ELECTRON_DISABLE_GPU` | `0` | Set to `1` to disable hardware acceleration |
| `ELECTRON_USER_DATA_DIR` | (default) | Custom user data directory |

---

## File Structure

```
CoverseStandalone/
├── main.js              # Electron main process
├── preload.js           # Context bridge (coverse API)
├── renderer.js          # Local UI logic
├── index.html           # Local UI markup
├── styles.css           # Styles
├── config.js            # Configuration
├── websocket-server.js  # VST communication
├── native-helper.js     # Native window control
└── assets/
    └── icon.png         # App icon
```

---

## Making Changes

### Adding New IPC Channels

1. **main.js**: Add handler
   ```javascript
   ipcMain.handle('my-channel', async (event, arg) => {
     return result;
   });
   ```

2. **preload.js**: Expose to renderer
   ```javascript
   contextBridge.exposeInMainWorld('coverse', {
     myMethod: (arg) => ipcRenderer.invoke('my-channel', arg)
   });
   ```

3. **renderer.js**: Use it
   ```javascript
   const result = await window.coverse.myMethod(arg);
   ```

### Modifying siteWindow Behavior

Changes to `openSiteWindow()` in main.js affect how CoverseHQ loads. Key settings:

- `partition`: Must be `'persist:coverse'` for auth persistence
- `setWindowOpenHandler`: Controls popup behavior (OAuth, etc.)
- `webSecurity`: Keep `true` for security

---

## Testing Checklist

- [ ] App starts without console errors
- [ ] "Open in app window" launches CoverseHQ
- [ ] Firebase login works in dedicated window
- [ ] Auth persists after closing/reopening app
- [ ] No "Signout received" spam in console
- [ ] Call tab works (camera/mic preview)
- [ ] Contacts load after sign-in
- [ ] Messages load after sign-in
- [ ] Minimize to tray works
- [ ] Tray icon shows context menu

---

## Build & Release

```powershell
# Development
npm start

# Build for Windows
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
npm run build:win -- --config.win.signAndEditExecutable=false

# Output in dist/
```

### In-App Auto-Update (Prompt + Restart)

The app now checks for updates when packaged and prompts users to download/restart.

Requirements:
- Build must include `electron-updater` dependency.
- Packaged app must know where updates are hosted.

Recommended host setup (global users):
1. Use any HTTPS static host/CDN (S3 + CloudFront, Cloudflare R2, Azure Blob, etc.).
2. Upload Windows release artifacts from `dist/` to one stable URL path.
3. Ensure that URL serves:
  - `latest.yml`
  - Latest installer/exe and blockmap files generated by electron-builder

Runtime feed URL:
- Build-time feed is embedded from `package.json > build.publish`.
- Current configured feed: `https://updates.coversehq.com/coverse/win`
- Optional override for packaged runtime: `COVERSE_UPDATE_URL`

Release update flow:
1. Bump version in `package.json` (example: `1.0.0` → `1.0.1`).
2. Build: `npm run build:win`.
3. Replace files on update host with the new `dist/` artifacts.
4. Users on older version receive update prompt automatically.

Testing with remote tester (different city):
1. Send tester the installer once and have them install normally.
2. Ensure both of you can reach the same signaling/backend services over internet.
3. Publish a newer app version to your update host.
4. Tester opens app and gets prompted to download + restart update.

Detailed release/rollback SOP: see `UPDATE_OPERATIONS.md`.

---

## Known Limitations

1. **Google Sign-In in file:// context**: If mainWindow loads `file://index.html`, Google OAuth popup won't work there. Use the dedicated window.

2. **Cross-window auth sync**: Auth tokens from siteWindow don't automatically sync to mainWindow. The local UI uses `localStorage.coverseIdToken` which is set via postMessage when available.

3. **OAuth popups**: Currently allowed for `accounts.google.com` in siteWindow. Other OAuth providers may need to be added to the allowlist in `openSiteWindow()`.
