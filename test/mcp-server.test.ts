import { describe, expect, test } from "bun:test"
import { spawn, type ChildProcess } from "node:child_process"
import { createInterface } from "node:readline"
import { resolve } from "node:path"

const projectRoot = resolve(import.meta.dir, "..")

type RpcResponse = {
  jsonrpc: "2.0"
  id: number
  result?: unknown
  error?: { code: number; message: string }
}

function startServer(): {
  child: ChildProcess
  send: (method: string, params?: unknown) => Promise<RpcResponse>
  close: () => Promise<number | null>
} {
  const child = spawn(process.execPath, ["run", "src/index.tsx", "server", "start"], {
    cwd: projectRoot,
    stdio: ["pipe", "pipe", "pipe"],
  })
  const lines = createInterface({ input: child.stdout, terminal: false, crlfDelay: Infinity })
  const pending = new Map<number, { resolve: (value: RpcResponse) => void; reject: (error: Error) => void }>()
  let nextId = 1

  lines.on("line", (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let message: RpcResponse
    try {
      message = JSON.parse(trimmed) as RpcResponse
    } catch {
      return
    }
    if (typeof message.id !== "number" || !pending.has(message.id)) return
    const entry = pending.get(message.id)!
    pending.delete(message.id)
    if (message.error) entry.resolve(message)
    else entry.resolve(message)
  })

  const send = (method: string, params?: unknown) => {
    const id = nextId++
    return new Promise<RpcResponse>((resolveResponse, reject) => {
      pending.set(id, { resolve: resolveResponse, reject })
      child.stdin!.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`)
    })
  }

  const close = () =>
    new Promise<number | null>((resolveExit) => {
      child.stdin!.end()
      child.once("exit", (code) => resolveExit(code))
    })

  return { child, send, close }
}

describe("MCP server (stdio)", () => {
  test("initialize 握手返回协议版本与服务信息", async () => {
    const server = startServer()
    const response = await server.send("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0.0.0" },
    })
    expect(response.error).toBeUndefined()
    const result = response.result as { protocolVersion: string; serverInfo: { name: string; version: string } }
    expect(result.protocolVersion).toBe("2025-06-18")
    expect(result.serverInfo.name).toContain("mcp")
    await server.close()
  })

  test("tools/list 自动注册 extensions 工具命令", async () => {
    const server = startServer()
    await server.send("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0.0.0" } })
    const response = await server.send("tools/list")
    expect(response.error).toBeUndefined()
    const result = response.result as {
      tools: Array<{ name: string; description: string; inputSchema: { type: string; properties: Record<string, unknown> } }>
    }
    const names = result.tools.map((tool) => tool.name)
    expect(names).toContain("codex-provider.status")
    expect(names).toContain("codex-provider.autosign")
    const statusTool = result.tools.find((tool) => tool.name === "codex-provider.status")!
    expect(statusTool.inputSchema.type).toBe("object")
    expect(statusTool.inputSchema.properties).toHaveProperty("args")
    await server.close()
  })

  test("tools/call 执行命令并返回 CLI 文本输出", async () => {
    const server = startServer()
    await server.send("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0.0.0" } })
    const response = await server.send("tools/call", {
      name: "codex-provider.status",
      arguments: { args: [] },
    })
    expect(response.error).toBeUndefined()
    const result = response.result as { content: Array<{ type: string; text: string }>; isError: boolean }
    expect(result.isError).toBe(false)
    expect(result.content[0].type).toBe("text")
    expect(result.content[0].text.length).toBeGreaterThan(0)
    await server.close()
  })

  test("tools/call 未注册工具返回 isError", async () => {
    const server = startServer()
    await server.send("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0.0.0" } })
    const response = await server.send("tools/call", { name: "no.such-tool", arguments: {} })
    const result = response.result as { content: Array<{ type: string; text: string }>; isError: boolean }
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("工具未注册")
    await server.close()
  })

  test("未知方法返回 -32601", async () => {
    const server = startServer()
    await server.send("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0.0.0" } })
    const response = await server.send("no/such/method")
    expect(response.error?.code).toBe(-32601)
    await server.close()
  })

  test("stdin 关闭（EOF）后进程退出", async () => {
    const server = startServer()
    await server.send("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0.0.0" } })
    const code = await server.close()
    expect(code).toBe(0)
  })
})

describe("--run 单次执行", () => {
  test("--run 执行工具命令并输出结果", async () => {
    const child = spawn(process.execPath, ["run", "src/index.tsx", "--run", "codex-provider", "status"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()))
    const exitCode = await new Promise<number | null>((resolveExit) => child.once("exit", resolveExit))
    expect(exitCode).toBe(0)
    expect(stdout.trim().length).toBeGreaterThan(0)
    expect(stderr.trim()).toBe("")
  })

  test("--run 缺少参数报用法错误", async () => {
    const child = spawn(process.execPath, ["run", "src/index.tsx", "--run"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()))
    const exitCode = await new Promise<number | null>((resolveExit) => child.once("exit", resolveExit))
    expect(exitCode).toBe(1)
    expect(stderr).toContain("--run")
  })

  test("--run 不存在的工具报错", async () => {
    const child = spawn(process.execPath, ["run", "src/index.tsx", "--run", "no-such-tool", "status"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stderr = ""
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()))
    const exitCode = await new Promise<number | null>((resolveExit) => child.once("exit", resolveExit))
    expect(exitCode).toBe(1)
    expect(stderr).toContain("工具未找到")
  })
})

describe("server stop", () => {
  test("无 pid 文件时提示并退出 1", async () => {
    const child = spawn(process.execPath, ["run", "src/index.tsx", "server", "stop"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stderr = ""
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()))
    const exitCode = await new Promise<number | null>((resolveExit) => child.once("exit", resolveExit))
    expect(exitCode).toBe(1)
    expect(stderr).toContain("没有运行中的")
  })
})
