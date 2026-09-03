import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")

describe("uninstall scripts", () => {
  test("Windows removes only the verified generated directory and waits for a key", async () => {
    const script = await readFile(resolve(root, "uninstall-windows.ps1"), "utf8")
    expect(script).toContain("Join-Path $projectDir '.cli-toolkit-fw'")
    expect(script).toContain("StartsWith($expectedPrefix")
    expect(script).toContain("Remove-Item -LiteralPath $generatedDirectory -Recurse -Force")
    expect(script).toContain("Join-Path $projectDir 'node_modules'")
    expect(script).toContain("Remove-Item -LiteralPath $dependenciesDirectory -Recurse -Force")
    expect(script).toContain("[Console]::ReadKey($true)")
  })

  test("POSIX removes the exact generated directory and waits for a key", async () => {
    const script = await readFile(resolve(root, "uninstall.sh"), "utf8")
    expect(script).toContain('GENERATED_DIR="$SCRIPT_DIR/.cli-toolkit-fw"')
    expect(script).toContain('rm -rf -- "$GENERATED_DIR"')
    expect(script).toContain('DEPENDENCIES_DIR="$SCRIPT_DIR/node_modules"')
    expect(script).toContain('rm -rf -- "$DEPENDENCIES_DIR"')
    expect(script).toContain("Press any key to exit")
    expect(script).toContain("stty -echo -icanon")
  })
})
