# AI development contract

This repository is a reusable interactive CLI framework. Runtime behavior is local TypeScript code; do not add an LLM dependency unless the user explicitly requests one.

## Required workflow

When a user asks for a custom tool:

1. Read this file and `docs/CREATE_TOOL.md` before editing.
2. Clarify only decisions that materially change behavior or safety. Otherwise make reasonable assumptions.
3. Put every user-defined tool and all of its business logic under `extensions/<tool-id>/`. Do not place business logic in `src/`.
4. Create commands with `defineCommand` and the module with `defineTool`.
5. Default-export the finished `defineTool(...)` result from `extensions/<tool-id>/index.ts`. Discovery is automatic; do not create a manual registry.
6. Add or update tests under `test/`.
7. Run `bun run typecheck` and `bun test` before reporting completion.
8. Update the tool's own README when its configuration or commands change.
9. Every code, configuration, installer, interaction, or directory-layout change must update the relevant repository documentation in the same change. Work is not complete until documentation matches behavior.

## Framework invariants

- The home screen owns `/tools`; tool commands must not use that name.
- `/help`, `/clear`, and `/exit` are global commands supplied by the framework.
- Tool-level `/exit` returns home. Home-level `/exit` closes the application.
- Command names do not include the leading `/` in source code.
- Tool IDs and command IDs must be stable, lowercase, and unique.
- A tool command's scope is assigned by `defineTool`; do not add `scope` manually.
- Return UI actions through `CommandResult`. Do not import or mutate OpenTUI renderables from a tool.
- Preserve keyboard and mouse behavior in `src/ui/app.tsx` unless the user explicitly requests a UI change.
- Keep tools independent. A tool must not import another tool's internal files.
- `extensions/` is the only location for user-defined tools. Never place custom functionality under `src/`.
- The framework must still start with an empty tool list when `extensions/` is missing or empty.
- Do not add compatibility code for unrelated projects or previous product names.

## Security rules

- Never commit API keys, tokens, passwords, cookies, private endpoints, personal account names, or machine-specific absolute paths.
- Read secrets from environment variables or ignored local configuration files.
- Never include secrets in output, errors, fixtures, snapshots, or logs.
- Use argument arrays when starting processes; do not build shell commands from untrusted text.
- Destructive operations require a clear confirmation selection before execution.
- Do not request administrator/root privileges unless the user explicitly requires that behavior.
- Do not silently install software, change PATH, kill processes, or download and execute remote scripts from a tool command.

## Where to edit

- Default branding: `src/app-config.ts`; the installer-selected name overrides it through `CLI_TOOLKIT_FW_NAME`.
- Tool implementations and automatic discovery input: `extensions/<tool-id>/`
- Framework types: `src/core/types.ts`
- Shared table output: `src/core/table.ts`
- UI shell: `src/ui/app.tsx`
- Logging: `src/platform/logger.ts`
- Installer command/environment names: installation and launcher scripts in the repository root

Use `examples/basic-tool/` as the canonical implementation example. It is documentation-only. To enable a derived tool, copy or create it under `extensions/`; never import it into framework source manually.
