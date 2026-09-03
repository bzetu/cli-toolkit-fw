# Architecture

The project has four layers:

```text
src/index.tsx          application composition
src/ui/                terminal rendering and input handling
src/core/              public command/tool contracts and registries
extensions/            all user-specific tools and business logic
```

`src/index.tsx` asks `src/core/extensions.ts` to scan direct child directories under `extensions/`. Each child may provide an `index.ts`, `index.tsx`, `index.js`, or `index.mjs` with a default-exported tool. The resulting tools are passed to the UI.

The extensions directory is optional. Missing or empty means an empty tool list and is the normal default framework state.

Git tracks only `extensions/.gitkeep`. All actual extension directories are ignored so a customized local toolkit does not publish private tools or configuration with the reusable framework.

Each route has an independent transcript. Home and tool routes share global commands but do not expose one another's scoped commands.

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

## Extension boundary

Normal customization should only touch:

```text
src/app-config.ts
extensions/
test/
```

Change `src/core/` or `src/ui/` only when adding a reusable framework capability that multiple tools need.
