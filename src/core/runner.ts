import type { Command, CommandResult, ToolModule } from "./types"

export class ToolNotFoundError extends Error {
  constructor(toolID: string) {
    super(`工具未找到：${toolID}`)
    this.name = "ToolNotFoundError"
  }
}

export class CommandNotFoundError extends Error {
  constructor(toolID: string, commandName: string) {
    super(`命令未找到：${toolID} /${commandName}`)
    this.name = "CommandNotFoundError"
  }
}

/** Find a command by tool ID and command name (case-insensitive, alias-aware). */
export function findCommand(
  tools: ToolModule[],
  toolID: string,
  commandName: string,
): { tool: ToolModule; command: Command } {
  const tool = tools.find((candidate) => candidate.id === toolID)
  if (!tool) throw new ToolNotFoundError(toolID)
  const folded = commandName.toLowerCase()
  const command = tool.commands.find(
    (candidate) =>
      candidate.name.toLowerCase() === folded ||
      candidate.aliases?.some((alias) => alias.toLowerCase() === folded),
  )
  if (!command) throw new CommandNotFoundError(toolID, commandName)
  return { tool, command }
}

/** Render a CommandResult as plain text for non-interactive execution (MCP / --run). */
export function resultToText(result: CommandResult): string {
  if (result.output !== undefined) return result.output
  if (result.selection) {
    const options = result.selection.options
      .map((option) => `- ${option.title}${option.description ? `（${option.description}）` : ""}`)
      .join("\n")
    return [result.selection.title, options].filter(Boolean).join("\n")
  }
  if (result.navigate) return result.navigate.kind === "home" ? "已返回主界面。" : `已进入工具：${result.navigate.toolID}`
  if (result.clear) return "已清空输出。"
  if (result.exit) return ""
  return ""
}

/** Run one tool command non-interactively and return its plain-text output. */
export async function runToolCommand(
  tools: ToolModule[],
  toolID: string,
  commandName: string,
  args: string[],
  cwd: string,
): Promise<string> {
  const { tool, command } = findCommand(tools, toolID, commandName)
  const result = await command.run({ cwd, toolID: tool.id }, args)
  return resultToText(result)
}
