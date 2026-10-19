import { readFileSync } from "node:fs"
import path from "node:path"
import { homedir } from "node:os"

export type AuthInfo = {
  token: string
  serverUrl: string
  username: string
  expiresAt?: string
}

export type TeamMetrics = {
  teamMembers: string
  avgTeamMembers: string
  perCapitaCost: string
  avgPerCapitaCost: string
  perCapitaTokens: string
  avgPerCapitaTokens: string
}

export type TeamStatusData = {
  updateTime: string
  period: string
  username: string
  team: string
  rank: string
  requestCount: string
  totalCost: string
  costRatio: string
  totalTokens: string
  promptTokens: string
  avgRequestLength: string
  completionTokens: string
  cachedTokens: string
  cacheRatio: string
  longRequestCount: string
  codeLines: string
  currentBudget: string
  targetBudget: string
  validationResult: string
  teamMetrics?: TeamMetrics
}

/** Path to the cyoucode authentication file. */
function authFilePath(): string {
  return path.join(homedir(), ".cyoucode", "cyou_auth.json")
}

/** Read the cyoucode access token and server URL from the local auth file. */
export function readAuthInfo(): AuthInfo {
  const raw = readFileSync(authFilePath(), "utf-8")
  const auth = JSON.parse(raw) as {
    access_token: string
    server_url: string
    username: string
    expires_at?: string
  }
  return {
    token: auth.access_token,
    serverUrl: auth.server_url,
    username: auth.username,
    expiresAt: auth.expires_at,
  }
}

/** Strip HTML tags and normalize whitespace from a cell's inner HTML. */
function cleanCell(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Extract all <td> cell values from a <tr> row's inner HTML. */
function extractTableCells(rowHtml: string): string[] {
  const cells: string[] = []
  const regex = /<td[^>]*>([\s\S]*?)<\/td>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(rowHtml)) !== null) {
    cells.push(cleanCell(match[1]))
  }
  return cells
}

/** Format a token count with Chinese units (万, 亿).
 *  - Below 1万: show raw value
 *  - 1万 ~ 1亿: show "X.XX万 (raw)"
 *  - 1亿+: show "X.XX亿 (raw)" */
export function formatTokenCount(value: string): string {
  const cleaned = value.replace(/,/g, "")
  const num = parseFloat(cleaned)
  if (isNaN(num)) return value
  if (num < 10000) return value
  if (num < 100000000) {
    return `${(num / 10000).toFixed(2)}万 (${cleaned})`
  }
  return `${(num / 100000000).toFixed(2)}亿 (${cleaned})`
}

/** Format a token count with Chinese units, without the raw number in parentheses.
 *  Used for the team-comparison section to keep lines short. */
function formatNumberShort(value: string): string {
  const num = parseFloat(value.replace(/,/g, ""))
  if (isNaN(num)) return value
  if (num < 10000) return value
  if (num < 100000000) {
    return `${(num / 10000).toFixed(2)}万`
  }
  return `${(num / 100000000).toFixed(2)}亿`
}

/** Parse the team-metrics comparison table (3rd table, no ID).
 *  Searches for a <table> containing "团队人数" and extracts
 *  team-members, per-capita cost, and per-capita token consumption. */
function parseTeamMetrics(html: string): TeamMetrics | null {
  const allTables = html.match(/<table[^>]*>([\s\S]*?)<\/table>/g) || []
  let metricsTable: string | null = null
  for (const tableHtml of allTables) {
    if (tableHtml.includes("团队人数")) {
      metricsTable = tableHtml
      break
    }
  }
  if (!metricsTable) return null

  // Build a map: metric name → [teamValue, avgValue]
  const tbody = metricsTable.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)
  const tbodyContent = tbody ? tbody[1] : metricsTable
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  let rowMatch: RegExpExecArray | null
  const metrics: Record<string, string[]> = {}
  while ((rowMatch = rowRegex.exec(tbodyContent)) !== null) {
    const cells = extractTableCells(rowMatch[1])
    if (cells.length >= 3) {
      metrics[cells[0]] = [cells[1], cells[2]]
    }
  }

  const teamMembers = metrics["团队人数"] ?? ["—", "—"]
  const perCapitaCost = metrics["人均API花费（$）"] ?? ["—", "—"]
  const perCapitaTokens = metrics["人均token消耗"] ?? ["—", "—"]

  return {
    teamMembers: teamMembers[0],
    avgTeamMembers: teamMembers[1],
    perCapitaCost: perCapitaCost[0],
    avgPerCapitaCost: perCapitaCost[1],
    perCapitaTokens: perCapitaTokens[0],
    avgPerCapitaTokens: perCapitaTokens[1],
  }
}

/** Parse the team-usage HTML page and extract status data.
 *  If `username` is provided, the matching row from the usage-detail
 *  table is used; otherwise the first data row is used. */
export function parseTeamUsageHtml(html: string, username?: string): TeamStatusData | null {
  // ── Meta info (统计更新时间, 统计范围) ──
  const updateTimeMatch = html.match(
    /<span[^>]*>统计更新时间[^<]*<\/span>\s*<strong[^>]*>(.*?)<\/strong>/,
  )
  const periodMatch = html.match(
    /<span[^>]*>统计范围<\/span>\s*<strong[^>]*>(.*?)<\/strong>/,
  )
  const updateTime = updateTimeMatch ? updateTimeMatch[1].trim() : "—"
  const period = periodMatch ? periodMatch[1].trim() : "—"

  // ── Budget upgrade table (当前额度, 目标额度, 校验结果) ──
  let currentBudget = "—"
  let targetBudget = "—"
  let validationResult = "—"
  const budgetTableMatch = html.match(
    /<table[^>]*id="budget-upgrade-table"[^>]*>([\s\S]*?)<\/table>/,
  )
  if (budgetTableMatch) {
    const tbodyMatch = budgetTableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)
    const tbody = tbodyMatch ? tbodyMatch[1] : budgetTableMatch[1]
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
    let rowMatch: RegExpExecArray | null
    while ((rowMatch = rowRegex.exec(tbody)) !== null) {
      const cells = extractTableCells(rowMatch[1])
      if (cells.length >= 8) {
        if (!username || cells[0] === username) {
          currentBudget = cells[2]
          targetBudget = cells[6]
          validationResult = cells[7]
          break
        }
      }
    }
  }

  // ── Usage detail table (14 columns per row) ──
  const detailTableMatch = html.match(
    /<table[^>]*id="usage-detail-table"[^>]*>([\s\S]*?)<\/table>/,
  )
  if (!detailTableMatch) return null

  const detailTbodyMatch = detailTableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)
  const detailTbody = detailTbodyMatch ? detailTbodyMatch[1] : detailTableMatch[1]

  const detailRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  let detailRowMatch: RegExpExecArray | null
  let targetCells: string[] | null = null
  let firstCells: string[] | null = null

  while ((detailRowMatch = detailRowRegex.exec(detailTbody)) !== null) {
    const cells = extractTableCells(detailRowMatch[1])
    if (cells.length >= 14) {
      if (firstCells === null) firstCells = cells
      if (!username || cells[1] === username) {
        targetCells = cells
        break
      }
    }
  }

  if (!targetCells) targetCells = firstCells
  if (!targetCells || targetCells.length < 14) return null

  // ── Team metrics comparison table (3rd table, no ID) ──
  const teamMetrics = parseTeamMetrics(html)

  return {
    updateTime,
    period,
    username: targetCells[1],
    team: targetCells[2],
    rank: targetCells[0],
    requestCount: targetCells[3],
    totalCost: targetCells[4],
    costRatio: targetCells[5],
    totalTokens: targetCells[6],
    promptTokens: targetCells[7],
    avgRequestLength: targetCells[8],
    completionTokens: targetCells[9],
    cachedTokens: targetCells[10],
    cacheRatio: targetCells[11],
    longRequestCount: targetCells[12],
    codeLines: targetCells[13],
    currentBudget,
    targetBudget,
    validationResult,
    teamMetrics: teamMetrics ?? undefined,
  }
}

/** Format the status data as a readable text block. */
export function formatStatusText(data: TeamStatusData): string {
  const lines: string[] = [
    `统计范围: ${data.period}`,
    `统计更新时间: ${data.updateTime}`,
    "",
    `用户名: ${data.username}`,
    `团队: ${data.team}`,
    `排名: ${data.rank}`,
    `请求次数: ${data.requestCount}`,
    `总花费: $${data.totalCost}`,
    `花费占比: ${data.costRatio}`,
    `当前额度: $${data.currentBudget}`,
    `目标额度: $${data.targetBudget}`,
    `校验结果: ${data.validationResult}`,
    "",
    `总 Tokens: ${formatTokenCount(data.totalTokens)}`,
    `Prompt Tokens: ${formatTokenCount(data.promptTokens)}`,
    `Completion Tokens: ${formatTokenCount(data.completionTokens)}`,
    `Cached Tokens: ${formatTokenCount(data.cachedTokens)}`,
    `缓存占比: ${data.cacheRatio}`,
    `平均请求长度: ${data.avgRequestLength}`,
    `超长请求数: ${data.longRequestCount}`,
    `代码处理行数: ${data.codeLines}`,
  ]

  if (data.teamMetrics) {
    const m = data.teamMetrics
    lines.push("")
    lines.push(`团队人数: ${m.teamMembers}    公司团队平均人数: ${m.avgTeamMembers}`)
    lines.push(`团队人均花费: $${m.perCapitaCost}    公司人均花费: $${m.avgPerCapitaCost}`)
    lines.push(`团队人均token消耗: ${formatNumberShort(m.perCapitaTokens)}    公司人均token消耗: ${formatNumberShort(m.avgPerCapitaTokens)}`)
  }

  return lines.join("\n")
}

/** Friendly message when the stored token has already expired. */
export function expiredTokenMessage(expiresAt: string): string {
  return `认证已过期（${expiresAt}），请在 cyoucode 客户端重新登录`
}

/** Classify a thrown fetch error into a readable Chinese message. */
export function describeFetchError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "获取数据超时（服务器未及时响应），请稍后重试"
  }
  if (error instanceof TypeError) {
    const code = (error as { cause?: { code?: string } }).cause?.code
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      return "无法解析服务器地址（DNS 失败），请检查是否已连接内网/VPN"
    }
    if (code === "ECONNREFUSED") {
      return "服务器拒绝连接（可能未联网或服务不可用），请检查内网连接"
    }
    if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") {
      return "连接被重置，请检查网络连接后重试"
    }
    if (code) {
      return `网络错误 (${code})，请检查网络连接`
    }
  }
  return "获取数据失败，请检查网络连接或认证是否过期"
}

/** Fetch the latest team-usage data.
 *  Tries the refresh endpoint (fresh data) with a short timeout, then
 *  falls back to the cached team-usage page (hourly auto-refreshed) if
 *  the refresh endpoint is unresponsive or slow.
 *  Returns a formatted text block, or an error message on failure. */
export async function fetchTeamStatus(): Promise<string> {
  let auth: AuthInfo
  try {
    auth = readAuthInfo()
  } catch {
    return "无法读取 cyoucode 认证信息（~/.cyoucode/cyou_auth.json 不存在或格式错误）"
  }

  const expiresAt = auth.expiresAt ? new Date(auth.expiresAt) : null
  if (expiresAt && !isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
    return expiredTokenMessage(auth.expiresAt!)
  }

  const token = encodeURIComponent(auth.token)
  const refreshUrl = `${auth.serverUrl}/api/team-usage/refresh-details?token=${token}`
  const pageUrl = `${auth.serverUrl}/team-usage?token=${token}`

  let html: string | null = null

  // Attempt 1: POST refresh endpoint (fresh data, short timeout)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    const response = await fetch(refreshUrl, {
      method: "POST",
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (response.ok) {
      html = await response.text()
    } else if (response.status === 401 || response.status === 403) {
      return `认证失败 (HTTP ${response.status})，认证已过期，请在 cyoucode 客户端重新登录`
    }
  } catch {
    // Refresh timed out or failed — fall back to cached page below
  }

  // Attempt 2: GET cached team-usage page (hourly auto-refreshed, ~2s)
  if (!html) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const response = await fetch(pageUrl, {
        method: "GET",
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return `认证失败 (HTTP ${response.status})，认证已过期，请在 cyoucode 客户端重新登录`
        }
        return `获取数据失败 (HTTP ${response.status})`
      }
      html = await response.text()
    } catch (error) {
      return describeFetchError(error)
    }
  }

  const data = parseTeamUsageHtml(html, auth.username)
  if (!data) {
    return "解析数据失败，未找到使用明细"
  }

  return formatStatusText(data)
}
