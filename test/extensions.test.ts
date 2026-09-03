import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadExtensions } from "../src/core/extensions"

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "cli-toolkit-fw-"))
  temporaryRoots.push(root)
  return root
}

describe("extension discovery", () => {
  test("missing extensions directory is the default empty state", async () => {
    expect(await loadExtensions(await temporaryRoot())).toEqual([])
  })

  test("loads default exports from direct child directories", async () => {
    const root = await temporaryRoot()
    const toolDir = join(root, "extensions", "demo")
    await mkdir(toolDir, { recursive: true })
    await writeFile(join(toolDir, "index.ts"), `
      export default {
        id: "demo",
        title: "Demo",
        description: "Demo tool",
        commands: [],
      }
    `)

    const tools = await loadExtensions(root)
    expect(tools.map((tool) => tool.id)).toEqual(["demo"])
  })
})
