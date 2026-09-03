import type { ToolCommand, ToolDefinition, ToolModule } from "./types"

/** Define a command that belongs to a tool. Its scope is assigned by defineTool. */
export function defineCommand(command: ToolCommand): ToolCommand {
  return command
}

/** Define a tool and bind every command to the tool's scope. */
export function defineTool(definition: ToolDefinition): ToolModule {
  return {
    ...definition,
    commands: definition.commands.map((command) => ({
      ...command,
      scope: definition.id,
    })),
  }
}
