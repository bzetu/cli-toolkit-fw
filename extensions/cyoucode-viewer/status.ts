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

export type KeyUsage = {
  apiKey: string
  keyName: string
  team: string
  source: string
  addedAt: string
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
}

export type TeamStatusData = {
  updateTime: string
  period: string
  keys: KeyUsage[]
  teamMetrics?: TeamMetrics
}

export type LeaderboardRow = {
  rank: string
  username: string
  requestCount: string
  promptTokens: string
  completionTokens: string
  totalTokens: string
  codeLines: string
  tokensPerCodeLine: string
  totalCost: string
  lastActive: string
}

export type LeaderboardInfo = {
  period: string
  generatedAt: string
  sortKey: string
  limit: string
  totalRows: number
  rows: LeaderboardRow[]
  myRow?: LeaderboardRow
}

type UsageDetail = {
  keyName: string
  team: string
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
}

type BudgetRow = {
  apiKeyCell: string
  currentBudget: string
  targetBudget: string
  validationResult: string
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

/** Extract all data rows (arrays of <td> cell values) from a table's HTML. */
function extractTableRows(tableHtml: string): string[][] {
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)
  const tbody = tbodyMatch ? tbodyMatch[1] : tableHtml
  const rows: string[][] = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    rows.push(extractTableCells(rowMatch[1]))
  }
  return rows
}

/** Find a <table> element by its id attribute and return its inner HTML. */
function findTableById(html: string, id: string): string | null {
  const match = html.match(new RegExp(`<table[^>]*id="${id}"[^>]*>([\\s\\S]*?)</table>`))
  return match ? match[1] : null
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

/** Format a money value with a dollar prefix. Empty/placeholder values stay as-is. */
function formatMoney(value: string): string {
  const cleaned = value.trim()
  if (!cleaned || cleaned === "—" || cleaned === "-") {
    return cleaned || "—"
  }
  return `$${cleaned}`
}

/** Parse the team-metrics comparison table (contains "团队人数").
 *  Searches for a <table> containing "团队人数" and extracts team-members,
 *  per-capita cost, and per-capita token consumption. */
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
  const metrics: Record<string, string[]> = {}
  for (const cells of extractTableRows(metricsTable)) {
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

/** Parse the "我的 Key" table (my-keys-table): the authoritative list of the
 *  current user's API keys (key name, team, source, added time). */
function parseMyKeysTable(html: string): { apiKey: string; keyName: string; team: string; source: string; addedAt: string }[] {
  const table = findTableById(html, "my-keys-table")
  if (!table) return []
  const entries: { apiKey: string; keyName: string; team: string; source: string; addedAt: string }[] = []
  for (const cells of extractTableRows(table)) {
    // Columns: API Key, Key 名称, 绑定团队（user_alias）, 来源, 添加时间, 操作
    if (cells.length >= 5) {
      entries.push({
        apiKey: cells[0],
        keyName: cells[1],
        team: cells[2],
        source: cells[3],
        addedAt: cells[4],
      })
    }
  }
  return entries
}

/** Parse the usage-detail table (per-key usage stats), keyed by masked API key. */
function parseUsageDetailRows(html: string): Map<string, UsageDetail> {
  const table = findTableById(html, "usage-detail-table")
  const result = new Map<string, UsageDetail>()
  if (!table) return result
  for (const cells of extractTableRows(table)) {
    // Columns: 排名, API Key, Key 名称, 团队, 请求次数, 总花费（$）, 花费占比,
    //          总 Tokens(个), Prompt Tokens, 平均请求长度, Completion Tokens,
    //          Cached Tokens, 缓存占比, 超长请求数, 代码处理行数
    if (cells.length < 15) continue
    result.set(cells[1], {
      keyName: cells[2],
      team: cells[3],
      requestCount: cells[4],
      totalCost: cells[5],
      costRatio: cells[6],
      totalTokens: cells[7],
      promptTokens: cells[8],
      avgRequestLength: cells[9],
      completionTokens: cells[10],
      cachedTokens: cells[11],
      cacheRatio: cells[12],
      longRequestCount: cells[13],
      codeLines: cells[14],
    })
  }
  return result
}

/** Parse the budget-upgrade table (per-key budget validation). */
function parseBudgetRows(html: string): BudgetRow[] {
  const table = findTableById(html, "budget-upgrade-table")
  if (!table) return []
  const rows: BudgetRow[] = []
  for (const cells of extractTableRows(table)) {
    // Columns: 团队, API Key, 当前额度（$）, 本月花费（$）, 本月缓存占比,
    //          本月代码行数, 目标额度（$）, 校验结果, 操作
    if (cells.length < 8) continue
    rows.push({
      apiKeyCell: cells[1],
      currentBudget: cells[2],
      targetBudget: cells[6],
      validationResult: cells[7],
    })
  }
  return rows
}

/** Parse the team-usage HTML page (scope=my-keys) and extract status data.
 *  The page is key-centric: the my-keys table lists the user's keys, the
 *  usage-detail table holds per-key usage stats, and the budget-upgrade table
 *  holds per-key budget validation. Rows are merged by masked API key. */
export function parseTeamUsageHtml(html: string): TeamStatusData | null {
  // ── Meta info (统计更新时间, 统计范围) ──
  const updateTimeMatch = html.match(
    /<span[^>]*>统计更新时间[^<]*<\/span>\s*<strong[^>]*>(.*?)<\/strong>/,
  )
  const periodMatch = html.match(
    /<span[^>]*>统计范围<\/span>\s*<strong[^>]*>(.*?)<\/strong>/,
  )
  const updateTime = updateTimeMatch ? updateTimeMatch[1].trim() : "—"
  const period = periodMatch ? periodMatch[1].trim() : "—"

  const usageByApiKey = parseUsageDetailRows(html)
  const budgets = parseBudgetRows(html)
  const findBudget = (apiKey: string): BudgetRow | undefined =>
    budgets.find((budget) => budget.apiKeyCell.includes(apiKey))

  const keys: KeyUsage[] = []

  for (const entry of parseMyKeysTable(html)) {
    const usage = usageByApiKey.get(entry.apiKey)
    const budget = findBudget(entry.apiKey)
    keys.push({
      apiKey: entry.apiKey,
      keyName: usage?.keyName ?? entry.keyName,
      team: usage?.team ?? entry.team,
      source: entry.source,
      addedAt: entry.addedAt,
      requestCount: usage?.requestCount ?? "—",
      totalCost: usage?.totalCost ?? "—",
      costRatio: usage?.costRatio ?? "—",
      totalTokens: usage?.totalTokens ?? "—",
      promptTokens: usage?.promptTokens ?? "—",
      avgRequestLength: usage?.avgRequestLength ?? "—",
      completionTokens: usage?.completionTokens ?? "—",
      cachedTokens: usage?.cachedTokens ?? "—",
      cacheRatio: usage?.cacheRatio ?? "—",
      longRequestCount: usage?.longRequestCount ?? "—",
      codeLines: usage?.codeLines ?? "—",
      currentBudget: budget?.currentBudget ?? "—",
      targetBudget: budget?.targetBudget ?? "—",
      validationResult: budget?.validationResult ?? "—",
    })
  }

  // Fallback when the my-keys table is missing: build key entries from usage rows.
  if (keys.length === 0) {
    for (const [apiKey, usage] of usageByApiKey) {
      const budget = findBudget(apiKey)
      keys.push({
        apiKey,
        source: "—",
        addedAt: "—",
        ...usage,
        currentBudget: budget?.currentBudget ?? "—",
        targetBudget: budget?.targetBudget ?? "—",
        validationResult: budget?.validationResult ?? "—",
      })
    }
  }

  if (keys.length === 0) return null

  return {
    updateTime,
    period,
    keys,
    teamMetrics: parseTeamMetrics(html) ?? undefined,
  }
}

/** Parse the leaderboard HTML page and extract the ranking table plus meta info.
 *  When `username` is provided, the matching row is exposed as `myRow`. */
export function parseLeaderboardHtml(html: string, username?: string): LeaderboardInfo | null {
  const metaStrong = (label: string): string => {
    const match = html.match(new RegExp(`<span[^>]*>${label}[^<]*<strong[^>]*>(.*?)</strong>`))
    return match ? cleanCell(match[1]) : "—"
  }
  const period = metaStrong("排行榜统计")
  const generatedAt = metaStrong("缓存生成时间")
  const sortKey = metaStrong("当前排序")
  const limit = metaStrong("当前限制")

  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/)
  if (!tableMatch) return null

  const rows: LeaderboardRow[] = []
  for (const cells of extractTableRows(tableMatch[1])) {
    // Columns: 排名, 用户名, 请求总数, 输入 Tokens, 输出 Tokens, 总 Tokens,
    //          代码处理行数, 每行代码消耗 Token, 总成本 (USD), 最近活跃
    if (cells.length < 10) continue
    rows.push({
      rank: cells[0],
      username: cells[1],
      requestCount: cells[2],
      promptTokens: cells[3],
      completionTokens: cells[4],
      totalTokens: cells[5],
      codeLines: cells[6],
      tokensPerCodeLine: cells[7],
      totalCost: cells[8],
      lastActive: cells[9],
    })
  }
  if (rows.length === 0) return null

  const myRow = username ? rows.find((row) => row.username === username) : undefined
  return { period, generatedAt, sortKey, limit, totalRows: rows.length, rows, myRow }
}

/** Format the status data as a readable text block. */
export function formatStatusText(
  data: TeamStatusData,
  leaderboard?: LeaderboardInfo | null,
  username?: string,
): string {
  const lines: string[] = [
    `统计范围: ${data.period}`,
    `统计更新时间: ${data.updateTime}`,
  ]

  const displayName = leaderboard?.myRow?.username ?? username
  if (displayName) {
    lines.push("", `用户名: ${displayName}`)
  }

  if (leaderboard) {
    lines.push("", "── 排行榜（公司） ──")
    if (leaderboard.myRow) {
      const row = leaderboard.myRow
      lines.push(`排名: ${row.rank} / ${leaderboard.totalRows}`)
      lines.push(`请求总数: ${row.requestCount}`)
      lines.push(`输入 Tokens: ${formatTokenCount(row.promptTokens)}`)
      lines.push(`输出 Tokens: ${formatTokenCount(row.completionTokens)}`)
      lines.push(`总 Tokens: ${formatTokenCount(row.totalTokens)}`)
      lines.push(`代码处理行数: ${row.codeLines}`)
      lines.push(`每行代码消耗 Token: ${row.tokensPerCodeLine}`)
      lines.push(`最近活跃: ${row.lastActive}`)
    } else {
      lines.push(`排名: 未进入前 ${leaderboard.limit} 名（当前榜单共 ${leaderboard.totalRows} 人）`)
    }
    lines.push(`数据口径: ${leaderboard.period}，缓存生成时间 ${leaderboard.generatedAt}`)
  }

  lines.push("", "── 我的 Key 使用 ──")
  data.keys.forEach((key, index) => {
    if (index > 0) lines.push("")
    lines.push(`Key: ${key.keyName}（${key.apiKey}）`)
    lines.push(`团队: ${key.team}`)
    lines.push(`请求次数: ${key.requestCount}`)
    lines.push(`总花费: ${formatMoney(key.totalCost)}`)
    lines.push(`花费占比: ${key.costRatio}`)
    lines.push(`当前额度: ${formatMoney(key.currentBudget)}`)
    lines.push(`目标额度: ${formatMoney(key.targetBudget)}`)
    lines.push(`校验结果: ${key.validationResult}`)
    lines.push(`总 Tokens: ${formatTokenCount(key.totalTokens)}`)
    lines.push(`Prompt Tokens: ${formatTokenCount(key.promptTokens)}`)
    lines.push(`Completion Tokens: ${formatTokenCount(key.completionTokens)}`)
    lines.push(`Cached Tokens: ${formatTokenCount(key.cachedTokens)}`)
    lines.push(`缓存占比: ${key.cacheRatio}`)
    lines.push(`平均请求长度: ${key.avgRequestLength}`)
    lines.push(`超长请求数: ${key.longRequestCount}`)
    lines.push(`代码处理行数: ${key.codeLines}`)
  })

  if (data.teamMetrics) {
    const m = data.teamMetrics
    lines.push("", "── 团队指标对比 ──")
    lines.push(`团队人数: ${m.teamMembers}    公司团队平均人数: ${m.avgTeamMembers}`)
    lines.push(`团队人均花费: ${formatMoney(m.perCapitaCost)}    公司人均花费: ${formatMoney(m.avgPerCapitaCost)}`)
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

/** Error thrown when a page request returns a non-OK HTTP status. */
export class HttpStatusError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP ${status}`)
    this.name = "HttpStatusError"
    this.status = status
  }
}

/** Classify a page-fetch failure (HTTP status or network error) into a readable message. */
export function describePageFetchError(error: unknown): string {
  if (error instanceof HttpStatusError) {
    if (error.status === 401 || error.status === 403) {
      return `认证失败 (HTTP ${error.status})，认证已过期，请在 cyoucode 客户端重新登录`
    }
    return `获取数据失败 (HTTP ${error.status})`
  }
  return describeFetchError(error)
}

/** Fetch a page as text with a timeout. Throws HttpStatusError on non-OK responses. */
async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal })
    if (!response.ok) {
      throw new HttpStatusError(response.status)
    }
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

/** Fetch the latest personal usage status.
 *  Requests the team-usage page (scope=my-keys, per-key stats) and the
 *  leaderboard page (company-wide ranking) in parallel, parses both, and
 *  returns a formatted text block. The team-usage page is required; if the
 *  leaderboard page fails, the remaining data is still returned with a
 *  failure note appended. */
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
  const teamUsageUrl = `${auth.serverUrl}/team-usage?token=${token}&scope=my-keys`
  const leaderboardUrl = `${auth.serverUrl}/leaderboard?token=${token}`

  const [teamUsageResult, leaderboardResult] = await Promise.allSettled([
    fetchHtml(teamUsageUrl, 10_000),
    fetchHtml(leaderboardUrl, 10_000),
  ])

  if (teamUsageResult.status === "rejected") {
    return describePageFetchError(teamUsageResult.reason)
  }

  const data = parseTeamUsageHtml(teamUsageResult.value)
  if (!data) {
    return "解析数据失败，未找到使用明细"
  }

  let leaderboard: LeaderboardInfo | null = null
  let leaderboardError: string | null = null
  if (leaderboardResult.status === "fulfilled") {
    leaderboard = parseLeaderboardHtml(leaderboardResult.value, auth.username)
    if (!leaderboard) {
      leaderboardError = "排行榜页面解析失败，未找到排行数据"
    }
  } else {
    leaderboardError = describePageFetchError(leaderboardResult.reason)
  }

  let text = formatStatusText(data, leaderboard, auth.username)
  if (leaderboardError) {
    text += `\n\n（排行榜数据获取失败：${leaderboardError}）`
  }
  return text
}
