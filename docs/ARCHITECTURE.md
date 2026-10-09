# Architecture

The project has five layers:

```text
src/index.tsx          application composition and argv dispatch
src/server/            MCP stdio server and process management
src/ui/                terminal rendering and input handling
src/core/              public command/tool contracts, registries, shared runner
extensions/            all user-specific tools and business logic
```

`src/index.tsx` dispatches on the first argument. `server start` enters MCP stdio server mode, `server stop` stops a manually started debug instance, `--run <tool-id> <command-name> [args...]` executes a single command headlessly and prints its text output, and any other invocation opens the interactive terminal UI.

In all modes `src/index.tsx` asks `src/core/extensions.ts` to scan direct child directories under `extensions/`. Each child may provide an `index.ts`, `index.tsx`, `index.js`, or `index.mjs` with a default-exported tool. The resulting tools are passed to the UI, to the MCP server, or to the runner.

The extensions directory is optional. Missing or empty means an empty tool list and is the normal default framework state.

Git tracks only `extensions/.gitkeep`. All actual extension directories are ignored so a customized local toolkit does not publish private tools or configuration with the reusable framework.

Each route has an independent transcript. Home and tool routes share global commands but do not expose one another's scoped commands.

The UI reserves `Ctrl+C` for copying selected text and never treats it as an exit shortcut. With no active text selection the key combination is consumed without closing the application; navigation and application exit remain owned by the global `/exit` command. `Ctrl+A` selects all text in the input box so the user can copy or replace the entire value with a single shortcut.

Tools may depend on the public helpers in `src/core/`, Node/Bun APIs, and their own internal modules. Core and UI must not depend on a specific tool.

## Execution flow

```text
user input
  -> command lookup for current scope
  -> command.run(context, args)
  -> CommandResult
  -> output / selection / navigation / clear / exit
```

The leading slash is UI syntax. A command declared as `name: "status"` is invoked as `/status`.

## Headless execution (MCP server and --run)

`src/core/runner.ts` provides the shared non-interactive execution path:

```text
tool-id + command-name + args
  -> findCommand(tools, toolId, commandName)   # case-insensitive, alias-aware
  -> command.run({ cwd, toolID }, args)
  -> resultToText(result)                      # plain text for any CommandResult
```

`resultToText` maps every result kind to readable text: `output` is used as-is, `selection` is rendered as its title plus an option list, and `navigate` / `clear` / `exit` become short status lines. This is what `--run` prints and what the MCP server wraps in a text content block.

The MCP server in `src/server/mcp.ts` is a hand-written stdio JSON-RPC loop with no third-party dependency. It supports `initialize`, `ping`, `tools/list`, and `tools/call`. Every extension command is registered as a tool named `<tool-id>.<command-name>` with an `args: string[]` input schema. The server writes only JSON-RPC messages to stdout; runtime errors go to the application log. When the client closes stdin the readline interface closes and the process exits. `src/server/process.ts` records the pid of a manually started debug instance (stdin is a TTY) and implements `server stop` for it; client-spawned instances are never recorded.

## Argument completion

A command may declare an optional `completeArgs(args, partial)` method that returns `CompletionItem[]`. When the user has typed a command name followed by a space, the framework calls this method to produce argument-aware Tab completions. The method receives the already-completed arguments and the partial token currently being typed. It must be synchronous; extensions that need cached data should preload it in `onEnter`.

## Extension boundary

Normal customization should only touch:

```text
src/app-config.ts
extensions/
test/
```

Change `src/core/` or `src/ui/` only when adding a reusable framework capability that multiple tools need.
