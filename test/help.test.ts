import { describe, expect, test } from "bun:test"
import { usageText } from "../src/help"

describe("usage text", () => {
  const text = usageText("jctools")

  test("uses the provided command name", () => {
    expect(text).toContain("jctools - ")
  })

  test("documents every headless entry point", () => {
    expect(text).toContain("server start")
    expect(text).toContain("server stop")
    expect(text).toContain("--run <工具ID> <命令名>")
    expect(text).toContain("--help")
  })

  test("documents the interactive completion behavior", () => {
    expect(text).toContain("Tab 或 Enter 补全选中项")
    expect(text).toContain("无补全菜单时按 Enter 执行命令")
  })
})
