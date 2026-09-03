import { appendFileSync, mkdirSync } from "node:fs"
import { homedir, platform } from "node:os"
import { dirname, join } from "node:path"

export const logFilePath = platform() === "win32"
  ? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "cli-toolkit-fw", "logs", "cli-toolkit-fw.log")
  : platform() === "darwin"
    ? join(homedir(), "Library", "Logs", "cli-toolkit-fw", "cli-toolkit-fw.log")
    : join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "cli-toolkit-fw", "cli-toolkit-fw.log")

function errorText(error: unknown) {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`
  return String(error)
}

export function logError(context: string, error: unknown) {
  try {
    mkdirSync(dirname(logFilePath), { recursive: true })
    appendFileSync(logFilePath, `[${new Date().toISOString()}] ${context}\n${errorText(error)}\n\n`, "utf8")
  } catch {
    // Logging must never hide the original application error.
  }
}

export function installGlobalErrorLogging() {
  process.on("uncaughtException", (error) => logError("uncaughtException", error))
  process.on("unhandledRejection", (error) => logError("unhandledRejection", error))
}
