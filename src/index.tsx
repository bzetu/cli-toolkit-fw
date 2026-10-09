/** @jsxImportSource @opentui/solid */

import { render } from "@opentui/solid"
import { resolve } from "node:path"
import { appConfig } from "./app-config"
import { loadExtensions } from "./core/extensions"
import { installGlobalErrorLogging, logError, logFilePath } from "./platform/logger"
import { runToolCommand } from "./core/runner"
import { serveMcp } from "./server/mcp"
import { recordPidIfInteractive, stopMcpServer } from "./server/process"
import { App } from "./ui/app"

const projectRoot = resolve(import.meta.dir, "..")
installGlobalErrorLogging()

const args = process.argv.slice(2)
const mode = args[0]

if (mode === "server") {
  const sub = args[1]
  if (sub === "start") {
    try {
      const tools = await loadExtensions(projectRoot)
      recordPidIfInteractive()
      await serveMcp(tools, { name: `${appConfig.name}-mcp`, version: "1.0.0" }, projectRoot)
    } catch (error) {
      logError("mcp-server", error)
      console.error(`${appConfig.name} MCP server failed to start. Log: ${logFilePath}`)
      process.exitCode = 1
    }
  } else if (sub === "stop") {
    stopMcpServer()
  } else {
    console.error(`用法：${appConfig.name} server start | server stop`)
    process.exitCode = 1
  }
} else if (mode === "--run") {
  const [toolID, commandName, ...rest] = args.slice(1)
  if (!toolID || !commandName) {
    console.error(`用法：${appConfig.name} --run <工具ID> <命令名> [参数...]`)
    process.exitCode = 1
  } else {
    try {
      const tools = await loadExtensions(projectRoot)
      const output = await runToolCommand(tools, toolID, commandName, rest, projectRoot)
      if (output) console.log(output)
    } catch (error) {
      logError("run", error)
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  }
} else {
  try {
    const tools = await loadExtensions(projectRoot)
    await render(() => <App appName={appConfig.name} cwd={projectRoot} tools={tools} />, {
      useMouse: true,
      exitOnCtrlC: false,
    })
  } catch (error) {
    logError("startup", error)
    console.error(`${appConfig.name} failed to start. Log: ${logFilePath}`)
    process.exitCode = 1
  }
}
