export type Route = { kind: "home" } | { kind: "tool"; toolID: string }

export type OutputTone = "normal" | "success" | "error" | "muted"

export type TranscriptEntry = {
  id: number
  kind: "input" | "output"
  text: string
  tone?: OutputTone
}

export type SelectOption = {
  id: string
  title: string
  description?: string
  current?: boolean
}

export type SelectionRequest = {
  title: string
  options: SelectOption[]
  onSelect(option: SelectOption): Promise<CommandResult> | CommandResult
}

export type CommandResult = {
  output?: string
  tone?: OutputTone
  selection?: SelectionRequest
  navigate?: Route
  exit?: boolean
  clear?: boolean
}

export type CommandContext = {
  cwd: string
  toolID?: string
}

export type Command = {
  id: string
  name: string
  aliases?: string[]
  title: string
  description: string
  scope: "global" | "home" | string
  run(context: CommandContext, args: string[]): Promise<CommandResult> | CommandResult
}

export type ToolCommand = Omit<Command, "scope">

export type ToolDefinition = Omit<ToolModule, "commands"> & {
  commands: ToolCommand[]
}

export type ToolModule = {
  id: string
  title: string
  description: string
  commands: Command[]
  onEnter?(context: CommandContext): Promise<CommandResult> | CommandResult
}
