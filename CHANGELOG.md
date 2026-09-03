# Changelog

All notable changes to this project are documented in this file. Versions follow Semantic Versioning.

## [0.2.1] - 2026-09-03

### Added

- README screenshots for installation, the command palette, and automatic local-extension discovery.
- A test that verifies every README screenshot reference resolves to a tracked image asset.

### Fixed

- Windows installation now broadcasts environment changes and verifies the selected command against the updated PATH.
- Windows Terminal restart guidance now distinguishes closing the whole application from opening a new tab with a stale environment.

## [0.2.0] - 2026-09-03

### Added

- Custom command and UI naming during installation, with `toolkit` as the default.
- Automatic discovery of local tools from the root `extensions/` directory.
- A tracked `extensions/.gitkeep` mount point and dedicated extension documentation.
- Safe uninstall cleanup for generated launchers and `node_modules`.
- Interactive key prompts at the end of install and uninstall scripts.
- Tests for extension discovery and uninstall-script safety.

### Changed

- User extensions and their local tests are now ignored by Git to prevent accidental publication.
- Installation records the selected name and launcher directory in framework environment variables.
- Reinstalling with a new name replaces the previous PATH registration.
- Documentation now requires every behavior or structure change to update relevant docs in the same change.

### Security

- Uninstall scripts verify generated directory paths before recursive removal.
- Local extension configuration and implementation files are excluded from the public repository.

## [0.1.0] - 2026-09-03

### Added

- Initial OpenCode-style interactive CLI framework.
- Tool and command contracts, scoped navigation, command completion, selections, tables, logging, tests, and cross-platform installation scripts.

[0.2.1]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v0.2.1
[0.2.0]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v0.2.0
[0.1.0]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v0.1.0
