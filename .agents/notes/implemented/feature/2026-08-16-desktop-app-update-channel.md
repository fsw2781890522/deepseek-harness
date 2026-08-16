# Agent Note: Desktop app update channel

Status: implemented

English | [中文](2026-08-16-desktop-app-update-channel.zh.md)

## Problem

The desktop wrapper ships the official Web UI inside a Tauri window. Replacing the product required rebuilding an NSIS installer and overwriting the previous setup.exe. The installed app had no in-product way to learn that a newer installer existed, and the construction repo did not keep versioned artifacts or a discovery document the app could fetch.

## Decision

The desktop construction repo (`dsh-desktop`) owns the update channel. Each build copies the NSIS installer into `releases/<version>/` instead of replacing a single unversioned file. `releases/latest.json` is the channel index the running app fetches. The schema is `schemaVersion: 1` with `channel`, `latest`, and a `releases` log. Each release carries bilingual `notes` and a `windows-x64` artifact (`kind` is `nsis` today; `runtime-zip` is reserved). Artifact URLs may be `https:`, `http:`, or `file:`. `DSH_DESKTOP_UPDATE_MANIFEST` overrides the configured manifest URL; when that URL is empty the app also looks for `latest.json` next to the executable.

The Tauri shell injects `window.__DSH_DESKTOP__` into every WebView document (splash and `http://127.0.0.1`). The object exposes `version`, `checkUpdate()`, and `installUpdate()`. Those map to `dsh_check_update` and `dsh_install_update`. Check compares the shell semver with `latest`. Install downloads the artifact the user was shown, verifies SHA-256, launches the NSIS installer silently (`/S`, last `/D=` the current install directory), and exits so the installer can replace the exe. User data stays in `~/.dsh`.

`ui-settings-general` registers a General item `desktop-update` (order 90) only when that bridge exists, so ordinary `dsh web` does not show the row. The row is Check for updates / 检查更新, then current / available-with-notes / error, then Install update / 立即更新.

## Alternatives considered

**Tauri updater plugin as the discovery protocol.** Rejected for the first channel: it expects its own signed JSON and still installs a full NSIS. The construction repo already versions a zip-plus-exe tree; a small owned schema records the changelog the Settings row shows and can grow a `runtime-zip` artifact later without changing the Settings contract.

**A new client plugin package for the Settings row.** Rejected: the row is ownerless product chrome that must not appear outside the desktop WebView, which matches `ui-settings-general`. A dedicated package would still load in every web composition.

**Always-on incremental zip replace with no installer.** Deferred: replacing only `bundle-runtime.zip` would skip NSIS, but a changed Tauri shell still needs an installer, and the first product entry is “a new published installer.” The schema keeps `kind: "runtime-zip"` so that path can ship without a new Settings IPC.

## Consequences

Browser `dsh web` is unchanged. Desktop users can check and install from Settings; a missing or empty manifest URL is an explicit failure rather than a silent skip. Installer binaries stay out of git; `latest.json`, notes, and SHA-256 sums are tracked. The first updater-capable shell is 0.2.0, so the first in-app upgrade a user can accept is a later version published on the same channel.

## Testing

Package tests cover the Settings row with a fake bridge (hidden without it; check and install invoke the bridge; available notes render). Desktop `update` unit tests cover semver compare, manifest parse, and “current vs available.” End-to-end install is a manual drop of `latest.json` plus a higher-version NSIS next to a 0.2.0 app.
