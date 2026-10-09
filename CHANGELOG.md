# Changelog

All notable changes to this project are documented in this file. Versions follow Semantic Versioning.

## [1.0.1] - 2026-10-09

### Added

- `--help` (also `-h` / `help`) entry point prints usage for the interactive UI, `server start`, `server stop`, `--run`, and `--help` itself.
- New `completeFromList` helper centralizes completion selection so `Tab` and `Enter` pick the same highlighted item.

### Changed

- In the interactive UI, `Enter` with an active completion menu (for example after typing `/autosign ` and seeing argument candidates) now completes the selected item instead of running the command without arguments; `Enter` runs the command only when no completion menu is open. `Tab` behaves the same as before.
- README terminology updated ("AI 工作任务接入" instead of "豆包工作任务接入"); README documents the `--help` entry point and the new `Enter` completion behavior.

## [1.0.0] - 2026-10-09

### Added

- Built-in MCP (Model Context Protocol) stdio server: `jctools server start` runs the framework as an MCP server, and every command of every discovered extension is registered automatically as an MCP tool named `<tool-id>.<command-name>` with an `args: string[]` input schema. Tool calls reuse the same command execution core and return the existing CLI terminal output; no platform conversion happens inside the framework.
- `jctools server stop` stops the manually started debug instance recorded in the pid file. Processes spawned by an MCP client are managed by the client and exit when the client closes stdin (EOF); they are not recorded and never need manual stopping.
- Non-interactive single-shot execution: `jctools --run <tool-id> <command-name> [args...]` runs one command, prints its plain-text output, and exits. UI-only result kinds (selection, navigation, clear, exit) are rendered as readable text instead of opening the terminal UI.
- A shared non-interactive execution core in `src/core/runner.ts` (`findCommand`, `resultToText`, `runToolCommand`) used by both the MCP server and `--run`.

### Changed

- Application entry `src/index.tsx` now dispatches on argv: `server start` / `server stop` / `--run` run headless; any other invocation opens the interactive terminal UI exactly as before.
- README and `docs/` now document MCP configuration for Doubao Tasks ("toolkit" connector: STDIO, command `bun.exe` — the absolute path of the native executable, since PATH `bun` is often an npm `.cmd`/`.ps1` wrapper — arguments `run <project-root>\src\index.tsx server start`), the auto-registration contract, and the format-conversion convention (platform formatting is done by the caller with a pre-written script, not inside the framework).
- `docs/ARCHITECTURE.md` adds the server layer; `docs/COMMAND_API.md` and `docs/EXTENSIONS.md` describe MCP exposure of tool commands.

## [0.2.3] - 2026-10-09

### Added

- Argument tab completion: commands may declare an optional `completeArgs(args, partial)` method; typing a space after a command name now completes arguments when supported.
- `Ctrl+A` selects all text in the input box for copying or replacement in one shortcut.

### Changed

- README, architecture and command API documentation now describe argument completion and the `Ctrl+A` shortcut.
- New `CompletionItem` contract and `completeArgs` hook in `src/core/types.ts`.

## [0.2.2] - 2026-09-07

### Fixed

- `Ctrl+C` no longer exits the application. It copies selected text when a selection exists and is otherwise ignored; `/exit` remains the only interactive exit command.
- Added regression coverage for copying selected text and consuming `Ctrl+C` without a selection.

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

[1.0.1]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v1.0.1
[1.0.0]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v1.0.0
[0.2.3]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v0.2.3
[0.2.2]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v0.2.2
[0.2.1]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v0.2.1
[0.2.0]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v0.2.0
[0.1.0]: https://github.com/bzetu/cli-toolkit-fw/releases/tag/v0.1.0
