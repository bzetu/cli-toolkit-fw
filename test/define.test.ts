import { describe, expect, test } from "bun:test"
import { defineCommand, defineTool } from "../src/core/define"

describe("tool definitions", () => {
  test("defineTool assigns its scope to every command", () => {
    const command = defineCommand({
      id: "demo.run",
      name: "run",
      title: "Run",
      description: "Run demo",
      run: () => ({ output: "done" }),
    })
    const tool = defineTool({
      id: "demo",
      title: "Demo",
      description: "Demo tool",
      commands: [command],
    })

    expect(tool.commands[0]?.scope).toBe("demo")
  })
})
