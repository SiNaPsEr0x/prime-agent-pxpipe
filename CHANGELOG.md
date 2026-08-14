# Changelog

## 1.2.0 - 2026-08-14

- Added polished README with project artwork and workflow graphics.
- Added `/pxpipe uninstall` and `/pxpipe-uninstall` best-effort full removal helpers.
- Added `uninstall.sh` for complete terminal-based removal.
- Added `publish.sh` to create and push a GitHub repository with GitHub CLI.
- Added `assets/` folder with README-ready visuals.
- Refined packaging for a community-ready GitHub release.

## 1.1.0 - 2026-08-14

- Added GitHub fast-forward auto-update bootstrap for unpinned git installs.
- Auto-update defaults to ON and checks at most once every 24 hours.
- Updated runtime is loaded during the same Prime-Agent startup when possible.
- Added `/pxpipe update` and `/pxpipe-update` manual updater with automatic `/reload`.
- Added `/pxpipe autoupdate on|off|status` and `/pxpipe-autoupdate`.
- Added `/pxpipe bug` and `/pxpipe-bug` GitHub Issues helper.
- Added version to the in-place pxpipe widget.
- State format v2 preserves compression and updater preferences together.
- Added GitHub bug-report issue template and contributing guide.
- Documented one-command `prime-agent package install git:...` setup.

## 1.0.0 - 2026-08-14

- Initial community release.
- Native `before_provider_request` pxpipe integration.
- Persistent global ON/OFF state.
- In-place post-response savings widget.
- Durable per-session statistics across reload/resume.
- `/pxpipe on|off|status|help` commands.
- Top-level `/pxpipe-*` aliases for Prime-Agent autocomplete compatibility.
- Default support for `gpt-5.6-sol` with configurable model allowlist.
