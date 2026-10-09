import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { logFilePath } from "../platform/logger"

const pidFilePath = join(dirname(logFilePath), "mcp-server.pid")

/** Record this process's pid when it was started manually from a terminal (stdin is a TTY).
 *  Processes spawned by an MCP client (piped stdin) are managed by the client and are not recorded. */
export function recordPidIfInteractive() {
  if (process.stdin.isTTY) {
    try {
      mkdirSync(dirname(pidFilePath), { recursive: true })
      writeFileSync(pidFilePath, String(process.pid), "utf8")
    } catch {
      // Recording the pid is best-effort; a running server must never fail because of it.
    }
  }
}

/** Stop the manually started debug instance recorded in the pid file. */
export function stopMcpServer(): void {
  if (!existsSync(pidFilePath)) {
    console.error("没有运行中的 MCP 调试实例（pid 文件不存在）。")
    process.exitCode = 1
    return
  }
  const raw = readFileSync(pidFilePath, "utf8").trim()
  const pid = Number.parseInt(raw, 10)
  if (!Number.isInteger(pid) || pid <= 0) {
    rmSync(pidFilePath, { force: true })
    console.error(`pid 文件内容无效（${raw}），已清除。`)
    process.exitCode = 1
    return
  }
  try {
    process.kill(pid)
    console.log(`已停止 MCP 调试实例（pid ${pid}）。`)
  } catch {
    console.error(`无法停止 pid ${pid}（进程可能已退出），已清除 pid 文件。`)
  }
  rmSync(pidFilePath, { force: true })
}
