import type { Command, ToolModule } from "./types"

export function createCoreCommands(
  tools: ToolModule[],
  commandsFor: (scope: string) => Command[],
): Command[] {
  return [
    {
      id: "app.tools",
      name: "tools",
      title: "工具列表",
      description: "浏览并进入工具模块",
      scope: "home",
      run() {
        if (tools.length === 0) {
          return {
            output: "当前还没有注册工具。\n\n请让 AI 阅读 AGENTS.md，并描述你想添加的工具和命令。",
            tone: "muted",
          }
        }
        return {
          output: "选择工具：",
          selection: {
            title: "Tools",
            options: tools.map((tool) => ({
              id: tool.id,
              title: tool.title,
              description: tool.description,
            })),
            onSelect(option) {
              return { navigate: { kind: "tool", toolID: option.id } }
            },
          },
        }
      },
    },
    {
      id: "app.help",
      name: "help",
      title: "帮助",
      description: "显示当前界面的全部命令",
      scope: "global",
      run(context) {
        const scope = context.toolID ?? "home"
        const rows = commandsFor(scope).map(
          (command) => `/${command.name.padEnd(10)} ${command.description}`,
        )
        return { output: ["可用指令：", ...rows].join("\n") }
      },
    },
    {
      id: "app.clear",
      name: "clear",
      title: "清空输出",
      description: "清空当前界面的执行历史",
      scope: "global",
      run() {
        return { clear: true }
      },
    },
    {
      id: "app.exit",
      name: "exit",
      title: "返回或退出",
      description: "工具内返回主界面，主界面退出程序",
      scope: "global",
      run(context) {
        if (context.toolID) return { navigate: { kind: "home" } }
        return { exit: true }
      },
    },
  ]
}
