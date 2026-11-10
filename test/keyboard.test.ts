import { describe, expect, test } from "bun:test"
import { completeFromList, escapeAction, handleCtrlA, handleCtrlC, inputKeptOnEscape, isCommandComplete, shouldRunWithoutCompletion } from "../src/ui/keyboard"

function ctrlCKey() {
  let prevented = false
  return {
    key: {
      ctrl: true,
      name: "c",
      preventDefault() {
        prevented = true
      },
    },
    wasPrevented: () => prevented,
  }
}

describe("Ctrl+C keyboard policy", () => {
  test("copies selected text without exposing an exit action", () => {
    const event = ctrlCKey()
    const copied: string[] = []

    expect(handleCtrlC(event.key, "selected output", (text) => copied.push(text))).toBe(true)
    expect(event.wasPrevented()).toBe(true)
    expect(copied).toEqual(["selected output"])
  })

  test("consumes Ctrl+C without a selection", () => {
    const event = ctrlCKey()
    const copied: string[] = []

    expect(handleCtrlC(event.key, "", (text) => copied.push(text))).toBe(true)
    expect(event.wasPrevented()).toBe(true)
    expect(copied).toEqual([])
  })

  test("leaves other key combinations untouched", () => {
    let prevented = false
    const key = {
      ctrl: false,
      name: "c",
      preventDefault() {
        prevented = true
      },
    }

  expect(handleCtrlC(key, "selected output", () => {})).toBe(false)
    expect(prevented).toBe(false)
  })
})

describe("Ctrl+A keyboard policy", () => {
  test("selects all text in the input", () => {
    let prevented = false
    let selected = false
    const key = {
      ctrl: true,
      name: "a",
      preventDefault() {
        prevented = true
      },
    }

    expect(handleCtrlA(key, () => { selected = true })).toBe(true)
    expect(prevented).toBe(true)
    expect(selected).toBe(true)
  })

  test("leaves other key combinations untouched", () => {
    let prevented = false
    const key = {
      ctrl: false,
      name: "a",
      preventDefault() {
        prevented = true
      },
    }

    expect(handleCtrlA(key, () => {})).toBe(false)
    expect(prevented).toBe(false)
  })

  test("does not intercept Ctrl+C", () => {
    let prevented = false
    const key = {
      ctrl: true,
      name: "c",
      preventDefault() {
        prevented = true
      },
    }

    expect(handleCtrlA(key, () => {})).toBe(false)
    expect(prevented).toBe(false)
  })
})

describe("completion selection", () => {
  const items = [
    { insert: "/autosign suoxie " },
    { insert: "/autosign viapi " },
    { insert: "/autosign namax " },
  ]

  test("returns the item at the selected index", () => {
    expect(completeFromList(items, 1)).toEqual({ insert: "/autosign viapi " })
  })

  test("returns the first item when the selected index is out of range", () => {
    expect(completeFromList(items, 99)).toEqual({ insert: "/autosign suoxie " })
  })

  test("returns undefined for an empty list", () => {
    expect(completeFromList([], 0)).toBeUndefined()
  })

  test("falls back to the first item for a negative index", () => {
    expect(completeFromList(items, -1)).toEqual({ insert: "/autosign suoxie " })
  })
})

describe("argument completeness (补齐后是否可执行)", () => {
  const single = [{ name: "target", required: false }]
  const withOptionalTail = [
    { name: "provider", required: true },
    { name: "account", required: true },
    { name: "amountUsd", required: false },
  ]

  test("returns true without args metadata (menu-disappearance rule decides)", () => {
    expect(isCommandComplete("/tools", undefined)).toBe(true)
  })

  test("optional-only args complete when the only slot is filled", () => {
    expect(isCommandComplete("/autosign suoxie", single)).toBe(true)
  })

  test("an empty optional slot keeps the command incomplete so the user can fill it", () => {
    expect(isCommandComplete("/autosign", single)).toBe(false)
  })

  test("all declared slots (including optional) must be filled before auto-run", () => {
    expect(isCommandComplete("/quota suoxie", withOptionalTail)).toBe(false)
    expect(isCommandComplete("/quota suoxie charles", withOptionalTail)).toBe(false)
    expect(isCommandComplete("/quota suoxie charles 25", withOptionalTail)).toBe(true)
  })

  test("trailing whitespace from completion does not affect the count", () => {
    expect(isCommandComplete("/quota suoxie charles 25 ", withOptionalTail)).toBe(true)
  })

  test("ignores non-command input", () => {
    expect(isCommandComplete("plain text", withOptionalTail)).toBe(false)
    expect(isCommandComplete("", withOptionalTail)).toBe(false)
  })
})

describe("Esc 关闭补全菜单但不清空输入", () => {
  test("按 Esc 且补全菜单开着时，只关菜单、保留输入", () => {
    expect(escapeAction({ hasSelection: false, hasCompletions: true, input: "/balance" }))
      .toBe("dismiss-menu")
  })

  test("按 Esc 且没有菜单时，才清空输入", () => {
    expect(escapeAction({ hasSelection: false, hasCompletions: false, input: "/balance" }))
      .toBe("clear-input")
  })

  test("输入框已空且无菜单时 Esc 什么也不做", () => {
    expect(escapeAction({ hasSelection: false, hasCompletions: false, input: "" }))
      .toBe("none")
  })

  test("关掉菜单后同一输入不重弹，但敲了空格就重新弹出", () => {
    // 等价于：Esc 只抑制当下这一帧，下一次输入（含删除后再敲空格）就恢复
    expect(escapeAction({ hasSelection: false, hasCompletions: true, input: "/balance" }))
      .toBe("dismiss-menu")
  })

  test("从未关闭过菜单时总是展示候选", () => {
    expect(escapeAction({ hasSelection: false, hasCompletions: false, input: "" })).toBe("none")
  })

  test("Esc 保留的内容会去掉补全尾随的空格，让光标停在命令名末尾", () => {
    expect(inputKeptOnEscape("/balance ")).toBe("/balance")
    expect(inputKeptOnEscape("/balance")).toBe("/balance")
    expect(inputKeptOnEscape("/balance   ")).toBe("/balance")
    // 已输入参数时保留空格分隔的内容本身
    expect(inputKeptOnEscape("/balance suoxie ")).toBe("/balance suoxie")
  })
})

describe("带可选参数的命令可以直接回车执行", () => {
  const optionalOnly = [{ name: "provider", required: false }]
  const withRequired = [{ name: "provider", required: true }]

  test("/balance 没输入参数时回车直接执行（不选候选）", () => {
    expect(shouldRunWithoutCompletion("/balance", optionalOnly)).toBe(true)
    expect(shouldRunWithoutCompletion("/balance ", optionalOnly)).toBe(true)
  })

  test("已经输入了参数时回车仍然走补全", () => {
    expect(shouldRunWithoutCompletion("/balance su", optionalOnly)).toBe(false)
  })

  test("有必填参数的命令不受影响", () => {
    expect(shouldRunWithoutCompletion("/quota", withRequired)).toBe(false)
  })

  test("未声明参数的命令不受影响", () => {
    expect(shouldRunWithoutCompletion("/tools", undefined)).toBe(false)
  })
})
