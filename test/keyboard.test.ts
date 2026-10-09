import { describe, expect, test } from "bun:test"
import { handleCtrlA, handleCtrlC } from "../src/ui/keyboard"

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
