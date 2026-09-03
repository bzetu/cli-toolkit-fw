/** @jsxImportSource @opentui/solid */

import { render } from "@opentui/solid"
import { resolve } from "node:path"
import { appConfig } from "./app-config"
import { loadExtensions } from "./core/extensions"
import { installGlobalErrorLogging, logError, logFilePath } from "./platform/logger"
import { App } from "./ui/app"

const projectRoot = resolve(import.meta.dir, "..")
installGlobalErrorLogging()

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
