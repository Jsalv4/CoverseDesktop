# Coverse Auto-Update Operations (Windows + macOS)

This document is the production SOP for shipping app updates to users globally.

## 1) One-time infrastructure setup

1. Create DNS record:
   - `updates.coversehq.com` -> your CDN/static host.
2. Serve artifacts from this exact path:
   - `https://updates.coversehq.com/coverse/win/`
3. Ensure HTTPS is valid (no self-signed certs).
4. Ensure this URL is publicly reachable worldwide.

## 2) Required files in update feed

For each release, publish all generated files for both platforms that match the version:

- `latest.yml`
- `Coverse Setup X.Y.Z.exe`
- `Coverse Setup X.Y.Z.exe.blockmap`
- `latest-mac.yml`
- `Coverse-X.Y.Z-arm64.dmg` / `Coverse-X.Y.Z-x64.dmg`
- `Coverse-X.Y.Z-arm64.zip` / `Coverse-X.Y.Z-x64.zip`
- corresponding `.blockmap` files

Do not rename files after build.

## 3) Release workflow (current stable)

Tag-based GitHub Actions workflow (`.github/workflows/release-win.yml`) builds and publishes both OS targets.

Signing/notarization secrets required for tag releases:

- Windows:
   - `WIN_CSC_LINK`
   - `WIN_CSC_KEY_PASSWORD`
- macOS:
   - `MAC_CSC_LINK`
   - `MAC_CSC_KEY_PASSWORD`
   - `APPLE_ID`
   - `APPLE_APP_SPECIFIC_PASSWORD`
   - `APPLE_TEAM_ID`

## 4) Release process (every update)

1. Bump app version in `package.json`.
2. Commit and push.
3. Create/push matching tag: `vX.Y.Z`.
4. Wait for GitHub Actions release workflow to complete.
5. Verify release assets include both Windows and macOS metadata/artifacts.
6. Launch old app version on test machine and run update check.

## 5) Verification checklist

- `latest.yml` opens in browser at:
  - `https://updates.coversehq.com/coverse/win/latest.yml`
- GitHub release contains:
   - `latest.yml` (Windows)
   - `latest-mac.yml` (macOS)
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
- Use valid code signing certs for all production installers.
- Ensure mac artifacts are notarized and stapled by CI before release.
- EV Windows certs reduce SmartScreen warning rates faster.

## 9) Manual check path for testers

The app exposes manual update checks via native menu/tray and renderer bridge:

- Tray menu: **Check for Updates**
- App menu: **Coverse -> Check for Updates**
- DevTools fallback: `window.coverse.checkForUpdates()`
