import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

test("README image references point to tracked local assets", () => {
  const root = resolve(import.meta.dir, "..")
  const readme = readFileSync(resolve(root, "README.md"), "utf8")
  const references = [...readme.matchAll(/!\[[^\]]*\]\((docs\/assets\/readme\/[^)]+)\)/g)]
    .map((match) => match[1])

  expect(references).toEqual([
    "docs/assets/readme/home-command-palette.png",
    "docs/assets/readme/extension-selector.png",
    "docs/assets/readme/install-custom-name.png",
  ])
  for (const reference of references) {
    expect(existsSync(resolve(root, reference!))).toBe(true)
  }
})
