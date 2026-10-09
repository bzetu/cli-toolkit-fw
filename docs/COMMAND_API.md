# Command API

Commands receive:

```ts
type CommandContext = {
  cwd: string
  toolID?: string
}
```

`args` contains whitespace-separated text after the command name. For `/show one two`, `args` is `["one", "two"]`.

## Results

A command returns one or more `CommandResult` fields.

Plain output:

```ts
return { output: "完成", tone: "success" }
```

Supported tones are `normal`, `success`, `error`, and `muted`.

Table output:

```ts
import { formatTable } from "../../../src/core/table"

return {
  output: formatTable(["名称", "状态"], [["demo", "正常"]]),
}
```

Interactive selection:

```ts
return {
  output: "请选择：",
  selection: {
    title: "项目",
    options: [
      { id: "a", title: "项目 A", description: "说明", current: true },
      { id: "b", title: "项目 B" },
    ],
    async onSelect(option) {
      return { output: `已选择 ${option.title}`, tone: "success" }
    },
  },
}
```

Other actions:

```ts
return { clear: true }
return { navigate: { kind: "home" } }
return { navigate: { kind: "tool", toolID: "demo" } }
return { exit: true }
```

Throw an `Error` when execution fails. The framework will show a user-facing error and write the stack to the application log.

## MCP exposure

When the framework runs as an MCP server (`jctools server start`), every command of every discovered extension is automatically registered as a tool named `<tool-id>.<command-name>`. For example `autosign` inside the `codex-provider` tool becomes the MCP tool `codex-provider.autosign` with an `args: string[]` input schema — an AI client calls it with `arguments: { "args": ["suoxie"] }`. The command's `run(context, args)` receives those args exactly as from the terminal, and the result text is returned as the tool output. No additional registration code is needed.

The single-shot `--run` form invokes the same command through the shared runner: `jctools --run codex-provider autosign suoxie`.

Because every command is exposed to AI clients, keep commands idempotent and side-effect free where possible (for example, a check-in tool should skip accounts that already checked in today), and return complete output in `result.output` rather than relying on UI-only interactions.

## Argument completion

A command may declare an optional `completeArgs` method so the user can Tab-complete arguments after the command name:

```ts
import { defineCommand } from "../../../src/core/define"
import type { CompletionItem } from "../../../src/core/types"

const providers = ["suoxie", "viapi", "namax"]

export const demoCommand = defineCommand({
  id: "demo.complete",
  name: "demo",
  title: "补全示例",
  description: "演示参数 Tab 补全",
  completeArgs(args, partial): CompletionItem[] {
    if (args.length === 0) {
      return providers
        .filter((p) => p.startsWith(partial))
        .map((p) => ({ text: p, description: "Provider" }))
    }
    // No completion for the second argument
    return []
  },
  async run(_context, args) {
    return { output: `选择了 ${args[0] ?? "（无）"}` }
  },
})
```

`completeArgs` receives the already-completed `args` and the `partial` token the user is currently typing. It must be **synchronous** — preload any async data (e.g. local config files) in `onEnter` and cache it module-level so `completeArgs` can read it instantly.

When a completion menu is open, `Tab` and `Enter` both accept the highlighted item into the input box; the command runs only when no menu is open and the user presses `Enter` again. This prevents accidentally running a command without its arguments.

## External processes

Use `Bun.spawn` with an argument array:

```ts
const process = Bun.spawn(["git", "status", "--short"], {
  cwd: context.cwd,
  stdout: "pipe",
  stderr: "pipe",
})

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(process.stdout).text(),
  new Response(process.stderr).text(),
  process.exited,
])

if (exitCode !== 0) throw new Error(stderr.trim() || `exit code ${exitCode}`)
return { output: stdout.trim() || "命令执行完成。" }
```

Do not interpolate untrusted values into a shell command string.
