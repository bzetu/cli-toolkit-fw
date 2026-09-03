# Creating a tool

## 1. Create the module

Use one directory per tool:

```text
extensions/git-manager/
  index.ts
  README.md
  commands/
    status.ts
    branches.ts
  services/
    git.ts
```

Keep command presentation in `commands/` and reusable business logic in `services/`.

## 2. Define commands

```ts
import { defineCommand } from "../../../src/core/define"

export const statusCommand = defineCommand({
  id: "git-manager.status",
  name: "status",
  title: "仓库状态",
  description: "显示当前 Git 仓库状态",
  async run(context, args) {
    return { output: `工作目录：${context.cwd}` }
  },
})
```

Do not include `/` in `name`. Do not set `scope`; `defineTool` assigns it.

## 3. Define the tool

```ts
import { defineTool } from "../../src/core/define"
import { statusCommand } from "./commands/status"

export default defineTool({
  id: "git-manager",
  title: "Git 管理",
  description: "查看和管理 Git 仓库",
  onEnter() {
    return { output: "已进入 Git 管理工具。", tone: "muted" }
  },
  commands: [statusCommand],
})
```

`onEnter` is optional and runs only the first time the tool is opened during the current application session.

## 4. Let the framework discover the tool

No registration file is required. Save the default export as `extensions/git-manager/index.ts` and restart the application. Direct child directories are discovered alphabetically.

Deleting `extensions/git-manager/` removes that tool on the next launch. Deleting or omitting the entire `extensions/` directory returns the application to its default empty state.

## 5. Add tests and documentation

Test business logic separately from UI rendering. Add a `README.md` inside the tool directory documenting commands, configuration, required executables, network access, and destructive behavior.

Finally run:

```text
bun run typecheck
bun test
```

For a complete documentation-only example, read `examples/basic-tool/`. Copy its pattern into `extensions/`; files under `examples/` are never loaded automatically.
