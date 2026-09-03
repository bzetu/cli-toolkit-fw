import { existsSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { ToolModule } from "./types"

const entryNames = ["index.ts", "index.tsx", "index.js", "index.mjs"]

function isToolModule(value: unknown): value is ToolModule {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<ToolModule>
  return typeof candidate.id === "string"
    && typeof candidate.title === "string"
    && typeof candidate.description === "string"
    && Array.isArray(candidate.commands)
}

/** Load one default-exported tool from each direct child of extensions/. */
export async function loadExtensions(projectRoot: string): Promise<ToolModule[]> {
  const extensionsDir = join(projectRoot, "extensions")
  if (!existsSync(extensionsDir)) return []

  const entries = await readdir(extensionsDir, { withFileTypes: true })
  const directories = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((left, right) => left.name.localeCompare(right.name))

  const tools: ToolModule[] = []
  for (const directory of directories) {
    const entryPath = entryNames
      .map((name) => join(extensionsDir, directory.name, name))
      .find((path) => existsSync(path))
    if (!entryPath) continue

    const module = await import(pathToFileURL(entryPath).href)
    if (!isToolModule(module.default)) {
      throw new Error(`扩展 ${directory.name} 必须默认导出 defineTool(...) 的结果`)
    }
    tools.push(module.default)
  }
  return tools
}
