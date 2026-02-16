# Coverse Standalone

Electron desktop app for Coverse collaboration workflows.

## Auto-update architecture (Windows + GitHub Releases)

This project uses:
- `electron-builder` to build Windows NSIS installers and update metadata
- `electron-updater` in main process to check/download/install updates
- GitHub Releases (`Jsalv4/CoverseDesktop`) as the update source

### Runtime behavior
- Checks for updates on startup (after a short delay)
- Re-checks every 6 hours
- Emits updater state to renderer over IPC (`coverse-update`)
- Supports:
  - Check now
  - Install and restart
  - Remind me later
- Never blocks app startup when updater fails
- Updater is disabled in development unless `COVERSE_ENABLE_DEV_UPDATER=1`

## One-time setup (GitHub Releases)

1. Ensure this repository exists on GitHub: `Jsalv4/CoverseDesktop`
2. In GitHub repo settings, allow releases.
3. Create a token with repo release permissions and store as:
   - local shell: `GH_TOKEN`
   - CI secret: `GH_TOKEN` (or `GITHUB_TOKEN` if your CI supports release publishing with it)
4. Confirm `package.json` has `build.publish` configured to GitHub owner/repo.

## Build, verify, release commands

```powershell
# 1) Build Windows installer + metadata
npm run build:win

# 2) Verify update config + release artifacts
npm run verify:update

# 3) Publish to GitHub Releases
# Requires GH_TOKEN in environment
npm run release:win
```

If your machine needs unsigned build compatibility for now:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
npm run build:win -- --config.win.signAndEditExecutable=false
```

## First release checklist (step-by-step)

1. Bump app version:
   ```powershell
   npm version patch --no-git-tag-version
   ```
2. Build:
   ```powershell
   npm run build:win
   ```
3. Verify updater artifacts:
   ```powershell
   npm run verify:update
   ```
4. Set token in current shell:
   ```powershell
   $env:GH_TOKEN='YOUR_GITHUB_TOKEN'
   ```
5. Publish release:
   ```powershell
   npm run release:win
   ```
6. Install prior app version on a test machine, open app, and run **Check for Updates**.

## Rollback procedure

If a bad version is released:
1. Re-publish the previous stable version as a new release (recommended), or mark bad release as not latest.
2. Ensure clients see a valid latest release with correct assets (`latest.yml`, installer, blockmap).
3. Have users run **Check for Updates**.

## Security and reliability notes

- Update source is GitHub over HTTPS.
- Keep updater tokens in env/CI secrets only (never hardcode).
- Updater lifecycle events are logged to console and to:
  - `%APPDATA%/../Local/.../logs/updater.log` via Electron `userData/logs/updater.log`
- Transient network updater errors use retry with exponential backoff.

## Known caveats (GitHub Releases at scale)

- Large installer downloads may be slower than dedicated CDN/object storage.
- GitHub API rate limits can impact heavy update traffic.
- For global scale and tighter control, migrate to dedicated update hosting.

## CI secret names expected

- `GH_TOKEN` (primary)
- Optional fallback: `GITHUB_TOKEN`

## Easy step-by-step guide (if you have never set up releases)

1. Go to GitHub -> `Jsalv4/CoverseDesktop`.
2. Open **Settings -> Developer settings -> Personal access tokens**.
3. Create token with repo release permissions.
4. In your terminal:
   ```powershell
   $env:GH_TOKEN='YOUR_TOKEN'
   ```
5. Run:
   ```powershell
   npm run release:win
   ```
6. Check GitHub -> Releases tab and confirm assets uploaded.
7. On tester machine open app -> **Check for Updates**.

## Future migration to downloads.coversehq.com

To switch from GitHub Releases to a generic provider later:

1. Change `package.json` `build.publish` from GitHub provider to:
   ```json
   {
     "provider": "generic",
     "url": "https://downloads.coversehq.com/coverse/win"
   }
   ```
2. Build new version.
3. Host `latest.yml`, installer, and blockmap at that URL.
4. Publish the new version and clients will follow new feed settings after update.
