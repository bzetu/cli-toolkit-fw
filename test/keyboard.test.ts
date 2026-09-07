import { describe, expect, test } from "bun:test"
import { handleCtrlC } from "../src/ui/keyboard"

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
