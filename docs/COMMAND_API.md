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
