import type { Command, ToolModule } from "./types"

export class ToolRegistry {
  private readonly tools = new Map<string, ToolModule>()

  register(tool: ToolModule) {
    if (this.tools.has(tool.id)) throw new Error(`工具 ID 重复：${tool.id}`)
    this.tools.set(tool.id, tool)
  }

  list() {
    return [...this.tools.values()]
  }

  get(id: string) {
    return this.tools.get(id)
  }
}

export class CommandRegistry {
  constructor(
    private readonly globalCommands: Command[],
    private readonly tools: ToolRegistry,
  ) {}

  list(scope: "home" | string): Command[] {
    const scoped = scope === "home" ? [] : (this.tools.get(scope)?.commands ?? [])
    return [...scoped, ...this.globalCommands.filter((command) => command.scope === "global" || command.scope === scope)]
  }

  find(scope: "home" | string, name: string) {
    const folded = name.toLowerCase()
    return this.list(scope).find(
      (command) => command.name.toLowerCase() === folded || command.aliases?.some((alias) => alias.toLowerCase() === folded),
    )
  }
}
