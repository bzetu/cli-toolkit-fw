import { expect, test } from "bun:test"
import { formatTable } from "../src/core/table"

test("formatTable aligns CJK and ASCII cells", () => {
  expect(formatTable(["Name", "状态"], [["demo", "正常"]])).toBe([
    "┌──────┬──────┐",
    "│ Name │ 状态 │",
    "├──────┼──────┤",
    "│ demo │ 正常 │",
    "└──────┴──────┘",
  ].join("\n"))
})
