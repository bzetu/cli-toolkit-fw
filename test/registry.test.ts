import { describe, expect, test } from "bun:test"
import { createCoreCommands } from "../src/core/commands"
import { CommandRegistry, ToolRegistry } from "../src/core/registry"
import type { Command, ToolModule } from "../src/core/types"

const toolCommand: Command = {
  id: "sample.run",
  name: "run",
  aliases: ["go"],
  title: "Run",
  description: "Run the sample tool",
  scope: "sample",
  run: () => ({ output: "done" }),
}

const sampleTool: ToolModule = {
  id: "sample",
  title: "Sample",
  description: "Sample tool",
  commands: [toolCommand],
}

function createRegistry() {
  const tools = new ToolRegistry()
  tools.register(sampleTool)
  let registry: CommandRegistry
  const core = createCoreCommands([sampleTool], (scope) => registry.list(scope))
  registry = new CommandRegistry(core, tools)
  return registry
}

describe("CommandRegistry", () => {
  test("home contains home and global commands, but no tool commands", () => {
    const names = createRegistry().list("home").map((command) => command.name)
    expect(names).toContain("tools")
    expect(names).toContain("help")
    expect(names).toContain("exit")
    expect(names).not.toContain("run")
  })

  test("tool scope contains tool and global commands, but no home commands", () => {
    const registry = createRegistry()
    const names = registry.list("sample").map((command) => command.name)
    expect(names).toContain("run")
    expect(names).toContain("help")
    expect(names).toContain("exit")
    expect(names).not.toContain("tools")
    expect(registry.find("sample", "GO")?.id).toBe("sample.run")
  })
})

describe("two-level exit", () => {
  test("tool exit navigates home", async () => {
    const command = createRegistry().find("sample", "exit")
    expect(await command?.run({ cwd: ".", toolID: "sample" }, [])).toEqual({ navigate: { kind: "home" } })
  })

  test("home exit closes the application", async () => {
    const command = createRegistry().find("home", "exit")
    expect(await command?.run({ cwd: "." }, [])).toEqual({ exit: true })
  })
})
