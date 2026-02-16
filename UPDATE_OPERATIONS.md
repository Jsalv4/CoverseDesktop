# Coverse Auto-Update Operations (Windows)

This document is the production SOP for shipping app updates to users globally.

## 1) One-time infrastructure setup

1. Create DNS record:
   - `updates.coversehq.com` -> your CDN/static host.
2. Serve artifacts from this exact path:
   - `https://updates.coversehq.com/coverse/win/`
3. Ensure HTTPS is valid (no self-signed certs).
4. Ensure this URL is publicly reachable worldwide.

## 2) Required files in update feed

For each release, upload all generated files from `dist/` that match the version:

- `latest.yml`
- `Coverse Setup X.Y.Z.exe`
- `Coverse Setup X.Y.Z.exe.blockmap`

Do not rename files after build.

## 3) Build command (current stable)

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
npm run build:win -- --config.win.signAndEditExecutable=false
```

## 4) Release process (every update)

1. Bump app version in `package.json`.
2. Build with command above.
3. Upload new artifacts to `https://updates.coversehq.com/coverse/win/`.
4. Verify `latest.yml` points to the same version and file names you uploaded.
5. Launch old app version on test machine and run update check.

## 5) Verification checklist

- `latest.yml` opens in browser at:
  - `https://updates.coversehq.com/coverse/win/latest.yml`
- Installer URL from `latest.yml` is downloadable.
- App shows update prompt on startup or manual check.
- Update downloads and restart/install succeeds.

## 6) CDN/cache policy (important)

Recommended cache-control:

- `latest.yml`: `Cache-Control: no-cache, no-store, must-revalidate`
- installer and blockmap: `Cache-Control: public, max-age=31536000, immutable`

This prevents stale metadata while allowing fast global downloads.

## 7) Rollback plan

If a bad release ships:

1. Re-upload previous known-good `latest.yml`.
2. Ensure referenced installer and blockmap exist.
3. Verify `latest.yml` now points to stable version.

Users checking updates afterward will stay or move to that stable release.

## 8) Security baseline

- Keep TLS enabled everywhere for update feed.
- Restrict write access to update storage (least privilege).
- Keep release artifacts immutable once published.
- Prefer code signing certificates for production trust at scale.

## 9) Manual check path for testers

The app exposes manual update checks via native menu/tray and renderer bridge:

- Tray menu: **Check for Updates**
- App menu: **Coverse -> Check for Updates**
- DevTools fallback: `window.coverse.checkForUpdates()`
