import { createInterface } from "node:readline"
import type { ToolModule } from "../core/types"
import { runToolCommand } from "../core/runner"

export const MCP_PROTOCOL_VERSION = "2025-06-18"

type JsonRpcMessage = {
  jsonrpc: "2.0"
  id?: number | string | null
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number; message: string }
}

const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602
const INTERNAL_ERROR = -32603

function toolName(toolID: string, commandName: string) {
  return `${toolID}.${commandName}`
}

function splitToolName(name: string): { toolID: string; commandName: string } {
  const separator = name.lastIndexOf(".")
  if (separator <= 0 || separator === name.length - 1) throw new Error("工具名格式应为 <工具ID>.<命令名>")
  return { toolID: name.slice(0, separator), commandName: name.slice(separator + 1) }
}

function inputSchema() {
  return {
    type: "object" as const,
    properties: {
      args: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "命令参数，按空格分隔逐项传入，例如 [\"suoxie\"]",
      },
    },
    required: [] as string[],
  }
}

export async function serveMcp(
  tools: ToolModule[],
  serverInfo: { name: string; version: string },
  cwd: string,
): Promise<void> {
  const registered = tools.flatMap((tool) =>
    tool.commands.map((command) => ({
      name: toolName(tool.id, command.name),
      description: `${tool.title}：${command.description}`,
      toolID: tool.id,
      commandName: command.name,
    })),
  )

  const respond = (message: JsonRpcMessage) => {
    process.stdout.write(`${JSON.stringify(message)}\n`)
  }

  const handle = async (message: JsonRpcMessage) => {
    if (message.method === undefined || message.id === undefined) {
      // Notifications (no id) are acknowledged silently; invalid requests get an error.
      if (message.id === undefined && message.method === undefined) {
        respond({ jsonrpc: "2.0", id: null, error: { code: INVALID_REQUEST, message: "无效请求" } })
      }
      return
    }
    try {
      switch (message.method) {
        case "initialize":
          respond({
            jsonrpc: "2.0",
            id: message.id,
            result: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: { tools: { listChanged: false } },
              serverInfo,
            },
          })
          break
        case "ping":
          respond({ jsonrpc: "2.0", id: message.id, result: {} })
          break
        case "tools/list":
          respond({
            jsonrpc: "2.0",
            id: message.id,
            result: {
              tools: registered.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: inputSchema(),
              })),
            },
          })
          break
        case "tools/call": {
          const params = message.params ?? {}
          const name = typeof params.name === "string" ? params.name : ""
          if (!name) {
            respond({ jsonrpc: "2.0", id: message.id, error: { code: INVALID_PARAMS, message: "缺少工具 name" } })
            break
          }
          const entry = registered.find((tool) => tool.name === name)
          if (!entry) {
            respond({
              jsonrpc: "2.0",
              id: message.id,
              result: { content: [{ type: "text", text: `工具未注册：${name}` }], isError: true },
            })
            break
          }
          const rawArgs = (params.arguments as Record<string, unknown> | undefined)?.args
          const args = Array.isArray(rawArgs) ? rawArgs.filter((item): item is string => typeof item === "string") : []
          try {
            const output = await runToolCommand(tools, entry.toolID, entry.commandName, args, cwd)
            respond({
              jsonrpc: "2.0",
              id: message.id,
              result: { content: [{ type: "text", text: output }], isError: false },
            })
          } catch (error) {
            respond({
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
                isError: true,
              },
            })
          }
          break
        }
        default:
          respond({ jsonrpc: "2.0", id: message.id, error: { code: METHOD_NOT_FOUND, message: `未知方法：${message.method}` } })
      }
    } catch (error) {
      respond({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: INTERNAL_ERROR, message: error instanceof Error ? error.message : String(error) },
      })
    }
  }

  const rl = createInterface({ input: process.stdin, terminal: false, crlfDelay: Infinity })
  rl.on("line", (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let message: JsonRpcMessage
    try {
      message = JSON.parse(trimmed) as JsonRpcMessage
    } catch {
      respond({ jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "无法解析 JSON" } })
      return
    }
    void handle(message)
  })

  await new Promise<void>((resolve) => {
    rl.on("close", () => resolve())
  })
}
