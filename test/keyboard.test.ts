import { describe, expect, test } from "bun:test"
import { completeFromList, handleCtrlA, handleCtrlC, isCommandComplete } from "../src/ui/keyboard"

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
