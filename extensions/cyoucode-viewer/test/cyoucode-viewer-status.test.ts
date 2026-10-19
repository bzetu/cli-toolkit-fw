import { describe, expect, test } from "bun:test"
import {
  parseTeamUsageHtml,
  parseLeaderboardHtml,
  parseLeaderboardJson,
  formatStatusText,
  formatTokenCount,
  describeFetchError,
  describePageFetchError,
  expiredTokenMessage,
  HttpStatusError,
  AuthRedirectError,
  type TeamStatusData,
  type LeaderboardInfo,
} from "../status"

/** Sample team-usage page (scope=my-keys, key-centric layout). */
const teamUsageHtml = `<!doctype html>
<html>
<head><title>CyouAPI 项目</title></head>
<body>
  <section class="meta-info">
    <div class="meta-item"><span>当前邮箱</span><strong>tester@example.com</strong></div>
    <div class="meta-item"><span>当前统计范围</span><strong>我的 Key（1 个）</strong></div>
    <div class="meta-item"><span>我的 Key</span><strong>1</strong></div>
    <div class="meta-item"><span>统计范围</span><strong>2026-10 月度统计</strong></div>
    <div class="meta-item"><span>使用明细记录</span><strong>1</strong></div>
    <div class="meta-item"><span>统计更新时间（每小时自动刷新）</span><strong>2026-10-19 11:26:49 CST</strong></div>
  </section>

  <section class="data-section my-keys-section">
    <table class="data-table" id="my-keys-table">
      <thead><tr>
        <th>API Key</th><th>Key 名称</th><th>绑定团队（user_alias）</th>
        <th>来源</th><th>添加时间</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>aaa111…zzz</td>
          <td>tester-key</td>
          <td>中台-测试</td>
          <td>手动添加</td>
          <td>2026-10-19 10:17</td>
          <td>清除</td>
        </tr>
      </tbody>
    </table>
  </section>

  <p class="section-description" id="teamUsageCacheStatus" aria-live="polite">
    统计数据每小时自动刷新，首次查询新的时间范围可能需要等待。
  </p>
  <div class="section-header">
    <p class="section-description">额度校验与使用明细更新时间：2026-10-19 11:30:12 CST</p>
    <button type="button" id="refreshUsageDetails" data-refresh-endpoint="/api/team-usage/refresh-details">刷新额度校验与使用明细</button>
  </div>

  <section class="data-section budget-upgrade-section">
    <table id="budget-upgrade-table" class="data-table">
      <thead><tr>
        <th>团队</th><th>API Key</th><th>当前额度（$）</th><th>本月花费（$）</th>
        <th>本月缓存占比</th><th>本月代码行数</th><th>目标额度（$）</th>
        <th>校验结果</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>中台-测试</td>
          <td>aaa111…zzztester-key</td>
          <td>150</td>
          <td>9.2</td>
          <td>97.32%</td>
          <td>2690</td>
          <td>—</td>
          <td>已达到最高额度</td>
          <td>已达最高</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="data-section usage-detail-section">
    <table id="usage-detail-table" class="data-table">
      <thead><tr>
        <th>排名</th><th>API Key</th><th>Key 名称</th><th>团队</th><th>请求次数</th>
        <th>总花费（$）</th><th>花费占比</th><th>总 Tokens(个)</th><th>Prompt Tokens</th>
        <th>平均请求长度</th><th>Completion Tokens</th><th>Cached Tokens</th>
        <th>缓存占比</th><th>超长请求数</th><th>代码处理行数</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>1</td><td>aaa111…zzz</td><td>tester-key</td><td>中台-测试</td><td>504</td>
          <td>9.2</td><td>100%</td><td>70664175</td><td>70342362</td>
          <td>139,568.18</td><td>321813</td><td>68460267</td><td>97.32%</td>
          <td>0</td><td>2690</td>
        </tr>
      </tbody>
    </table>
  </section>

  <section class="data-section team-metric-comparison-section">
    <table class="data-table">
      <thead><tr>
        <th>指标</th><th>本团队（中台-测试）</th><th>团队平均</th>
      </tr></thead>
      <tbody>
        <tr><td>团队人数</td><td>25</td><td>11.3</td></tr>
        <tr><td>人均API花费（$）</td><td>21.01</td><td>32.91</td></tr>
        <tr><td>人均token消耗</td><td>127,226,163.88</td><td>224,774,657.05</td></tr>
      </tbody>
    </table>
  </section>
</body>
</html>`

/** Two-key variant: the second key has a budget row but no usage row. */
const multiKeyHtml = teamUsageHtml
  .replace(
    `<tr>
          <td>aaa111…zzz</td>
          <td>tester-key</td>
          <td>中台-测试</td>
          <td>手动添加</td>
          <td>2026-10-19 10:17</td>
          <td>清除</td>
        </tr>`,
    `<tr>
          <td>aaa111…zzz</td>
          <td>tester-key</td>
          <td>中台-测试</td>
          <td>手动添加</td>
          <td>2026-10-19 10:17</td>
          <td>清除</td>
        </tr>
        <tr>
          <td>bbb222…yyy</td>
          <td>second-key</td>
          <td>中台-测试</td>
          <td>手动添加</td>
          <td>2026-10-18 09:00</td>
          <td>清除</td>
        </tr>`,
  )
  .replace(
    `<tr>
          <td>中台-测试</td>
          <td>aaa111…zzztester-key</td>
          <td>150</td>
          <td>9.2</td>
          <td>97.32%</td>
          <td>2690</td>
          <td>—</td>
          <td>已达到最高额度</td>
          <td>已达最高</td>
        </tr>`,
    `<tr>
          <td>中台-测试</td>
          <td>aaa111…zzztester-key</td>
          <td>150</td>
          <td>9.2</td>
          <td>97.32%</td>
          <td>2690</td>
          <td>—</td>
          <td>已达到最高额度</td>
          <td>已达最高</td>
        </tr>
        <tr>
          <td>中台-测试</td>
          <td>bbb222…yyysecond-key</td>
          <td>80</td>
          <td>10.5</td>
          <td>90.00%</td>
          <td>100</td>
          <td>120</td>
          <td>本月花费需达到 $60</td>
          <td>申请提升</td>
        </tr>`,
  )

/** Sample leaderboard page. */
const leaderboardHtml = `<!doctype html>
<html>
<head><title>Cyou AI 排行榜</title></head>
<body>
  <section class="meta-info">
    <span>当前排序：<strong>total_requests</strong></span>
    <span>当前限制：<strong>100</strong></span>
    <span>当前项目：<strong>CyouAPI 用量统计</strong></span>
    <span>排行榜统计：<strong>2026-10 月度统计</strong></span>
    <span>缓存生成时间：<strong>2026-10-19 10:00:50 CST</strong></span>
  </section>
  <section class="summary-section">
    <table>
      <thead><tr>
        <th>排名</th><th>用户名</th><th>请求总数</th><th>输入 Tokens</th>
        <th>输出 Tokens</th><th>总 Tokens</th><th>代码处理行数</th>
        <th>每行代码消耗 Token</th><th>总成本 (USD)</th><th>最近活跃</th>
      </tr></thead>
      <tbody>
        <tr><td>#1</td><td>user-a</td><td>24338</td><td>955031680</td><td>15026783</td><td>970058463</td><td>7328</td><td>132377.0</td><td>0.0000</td><td>2026-10-17</td></tr>
        <tr><td>#2</td><td>tester</td><td>502</td><td>70342362</td><td>321813</td><td>70664175</td><td>2690</td><td>26269.2</td><td>0.0000</td><td>2026-10-16</td></tr>
        <tr><td>#3</td><td>user-c</td><td>120</td><td>1000000</td><td>500000</td><td>1500000</td><td>300</td><td>5000.0</td><td>0.0000</td><td>2026-10-15</td></tr>
      </tbody>
    </table>
  </section>
</body>
</html>`

describe("expiredTokenMessage", () => {
  test("mentions expiry time and login hint", () => {
    expect(expiredTokenMessage("2026-09-01T00:00:00Z")).toBe(
      "认证已过期（2026-09-01T00:00:00Z），请在 cyoucode 客户端重新登录",
    )
  })
})

describe("describeFetchError", () => {
  test("abort errors report timeout", () => {
    const abortError = new Error("The operation was aborted")
    abortError.name = "AbortError"
    expect(describeFetchError(abortError)).toBe(
      "获取数据超时（服务器未及时响应），请稍后重试",
    )
  })

  test("DNS failures report network hint", () => {
    const err = new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } })
    expect(describeFetchError(err)).toBe(
      "无法解析服务器地址（DNS 失败），请检查是否已连接内网/VPN",
    )
  })

  test("connection refused reports server unreachable", () => {
    const err = new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } })
    expect(describeFetchError(err)).toBe(
      "服务器拒绝连接（可能未联网或服务不可用），请检查内网连接",
    )
  })

  test("resets report connection reset", () => {
    const err = new TypeError("fetch failed", { cause: { code: "ECONNRESET" } })
    expect(describeFetchError(err)).toBe(
      "连接被重置，请检查网络连接后重试",
    )
  })

  test("other network error codes include the code", () => {
    const err = new TypeError("fetch failed", { cause: { code: "ENETUNREACH" } })
    expect(describeFetchError(err)).toBe(
      "网络错误 (ENETUNREACH)，请检查网络连接",
    )
  })

  test("unknown errors fall back to generic message", () => {
    expect(describeFetchError(new Error("boom"))).toBe(
      "获取数据失败，请检查网络连接或认证是否过期",
    )
  })
})

describe("describePageFetchError", () => {
  test("redirected responses report invalid auth", () => {
    expect(describePageFetchError(new AuthRedirectError())).toBe(
      "认证已失效（响应被重定向到登录页），请在 cyoucode 客户端重新登录",
    )
  })

  test("HTTP 401/403 report expired auth", () => {
    expect(describePageFetchError(new HttpStatusError(401))).toBe(
      "认证失败 (HTTP 401)，认证已过期，请在 cyoucode 客户端重新登录",
    )
    expect(describePageFetchError(new HttpStatusError(403))).toBe(
      "认证失败 (HTTP 403)，认证已过期，请在 cyoucode 客户端重新登录",
    )
  })

  test("other HTTP statuses include the status code", () => {
    expect(describePageFetchError(new HttpStatusError(500))).toBe(
      "获取数据失败 (HTTP 500)",
    )
  })

  test("non-HTTP errors fall back to network classification", () => {
    const err = new TypeError("fetch failed", { cause: { code: "ECONNRESET" } })
    expect(describePageFetchError(err)).toBe(
      "连接被重置，请检查网络连接后重试",
    )
  })
})

describe("formatTokenCount", () => {
  test("below 1万 shows raw value", () => {
    expect(formatTokenCount("9999")).toBe("9999")
    expect(formatTokenCount("0")).toBe("0")
    expect(formatTokenCount("3386")).toBe("3386")
  })

  test("1万 to 1亿 shows 万 unit with raw in parens", () => {
    expect(formatTokenCount("1048511")).toBe("104.85万 (1048511)")
    expect(formatTokenCount("21000")).toBe("2.10万 (21000)")
  })

  test("1亿 and above shows 亿 unit with raw in parens", () => {
    expect(formatTokenCount("158737870")).toBe("1.59亿 (158737870)")
    expect(formatTokenCount("3053427933")).toBe("30.53亿 (3053427933)")
  })

  test("strips commas from input", () => {
    expect(formatTokenCount("1,587,378,670")).toBe("15.87亿 (1587378670)")
  })

  test("handles decimal values", () => {
    expect(formatTokenCount("127226163.88")).toBe("1.27亿 (127226163.88)")
  })
})

describe("parseTeamUsageHtml", () => {
  test("extracts per-key fields from the new key-centric layout", () => {
    const data = parseTeamUsageHtml(teamUsageHtml)
    expect(data).not.toBeNull()
    expect(data!.updateTime).toBe("2026-10-19 11:26:49 CST")
    expect(data!.detailUpdateTime).toBe("2026-10-19 11:30:12 CST")
    expect(data!.period).toBe("2026-10 月度统计")
    expect(data!.keys.length).toBe(1)

    const key = data!.keys[0]
    expect(key.apiKey).toBe("aaa111…zzz")
    expect(key.keyName).toBe("tester-key")
    expect(key.team).toBe("中台-测试")
    expect(key.source).toBe("手动添加")
    expect(key.addedAt).toBe("2026-10-19 10:17")
    expect(key.requestCount).toBe("504")
    expect(key.totalCost).toBe("9.2")
    expect(key.costRatio).toBe("100%")
    expect(key.totalTokens).toBe("70664175")
    expect(key.promptTokens).toBe("70342362")
    expect(key.avgRequestLength).toBe("139,568.18")
    expect(key.completionTokens).toBe("321813")
    expect(key.cachedTokens).toBe("68460267")
    expect(key.cacheRatio).toBe("97.32%")
    expect(key.longRequestCount).toBe("0")
    expect(key.codeLines).toBe("2690")
    expect(key.currentBudget).toBe("150")
    expect(key.targetBudget).toBe("—")
    expect(key.validationResult).toBe("已达到最高额度")
  })

  test("extracts team metrics from sample HTML", () => {
    const data = parseTeamUsageHtml(teamUsageHtml)
    expect(data).not.toBeNull()
    expect(data!.teamMetrics).not.toBeNull()
    expect(data!.teamMetrics!.teamMembers).toBe("25")
    expect(data!.teamMetrics!.avgTeamMembers).toBe("11.3")
    expect(data!.teamMetrics!.perCapitaCost).toBe("21.01")
    expect(data!.teamMetrics!.avgPerCapitaCost).toBe("32.91")
    expect(data!.teamMetrics!.perCapitaTokens).toBe("127,226,163.88")
    expect(data!.teamMetrics!.avgPerCapitaTokens).toBe("224,774,657.05")
  })

  test("parses multiple keys and defaults usage fields when a key has no usage row", () => {
    const data = parseTeamUsageHtml(multiKeyHtml)
    expect(data).not.toBeNull()
    expect(data!.keys.length).toBe(2)

    const second = data!.keys[1]
    expect(second.apiKey).toBe("bbb222…yyy")
    expect(second.keyName).toBe("second-key")
    expect(second.team).toBe("中台-测试")
    expect(second.requestCount).toBe("—")
    expect(second.totalCost).toBe("—")
    expect(second.totalTokens).toBe("—")
    expect(second.currentBudget).toBe("80")
    expect(second.targetBudget).toBe("120")
    expect(second.validationResult).toBe("本月花费需达到 $60")
  })

  test("returns null when neither my-keys nor usage-detail tables exist", () => {
    const html = "<html><body><div>no tables here</div></body></html>"
    expect(parseTeamUsageHtml(html)).toBeNull()
  })

  test("falls back to usage rows when the my-keys table is missing", () => {
    const html = teamUsageHtml.replace(/<section class="data-section my-keys-section">[\s\S]*?<\/section>/, "")
    const data = parseTeamUsageHtml(html)
    expect(data).not.toBeNull()
    expect(data!.keys.length).toBe(1)
    expect(data!.keys[0].apiKey).toBe("aaa111…zzz")
    expect(data!.keys[0].source).toBe("—")
    expect(data!.keys[0].addedAt).toBe("—")
    expect(data!.keys[0].requestCount).toBe("504")
  })

  test("returns default em-dash when meta items are missing", () => {
    const minimalHtml = `
      <table id="my-keys-table"><tbody>
        <tr><td>key1</td><td>key-name-1</td><td>team1</td><td>manual</td><td>2026-01-01</td><td>x</td></tr>
      </tbody></table>
      <table id="usage-detail-table"><tbody>
        <tr><td>1</td><td>key1</td><td>key-name-1</td><td>team1</td><td>500</td><td>50.00</td><td>10%</td><td>1000000</td><td>900000</td><td>2000</td><td>100000</td><td>800000</td><td>80%</td><td>5</td><td>2000</td></tr>
      </tbody></table>
    `
    const data = parseTeamUsageHtml(minimalHtml)
    expect(data).not.toBeNull()
    expect(data!.updateTime).toBe("—")
    expect(data!.detailUpdateTime).toBe("—")
    expect(data!.period).toBe("—")
    expect(data!.keys[0].requestCount).toBe("500")
    expect(data!.keys[0].currentBudget).toBe("—")
    expect(data!.teamMetrics).toBeUndefined()
  })
})

describe("parseLeaderboardHtml", () => {
  test("extracts meta info, rows and the current user's row", () => {
    const info = parseLeaderboardHtml(leaderboardHtml, "tester")
    expect(info).not.toBeNull()
    expect(info!.period).toBe("2026-10 月度统计")
    expect(info!.generatedAt).toBe("2026-10-19 10:00:50 CST")
    expect(info!.sortKey).toBe("total_requests")
    expect(info!.limit).toBe("100")
    expect(info!.cacheNote).toBe("每 4 小时自动刷新")
    expect(info!.totalRows).toBe(3)
    expect(info!.myRow).toBeDefined()
    expect(info!.myRow!.rank).toBe("#2")
    expect(info!.myRow!.username).toBe("tester")
    expect(info!.myRow!.requestCount).toBe("502")
    expect(info!.myRow!.promptTokens).toBe("70342362")
    expect(info!.myRow!.completionTokens).toBe("321813")
    expect(info!.myRow!.totalTokens).toBe("70664175")
    expect(info!.myRow!.codeLines).toBe("2690")
    expect(info!.myRow!.tokensPerCodeLine).toBe("26269.2")
    expect(info!.myRow!.totalCost).toBe("0.0000")
    expect(info!.myRow!.lastActive).toBe("2026-10-16")
  })

  test("leaves myRow undefined when the user is not on the board", () => {
    const info = parseLeaderboardHtml(leaderboardHtml, "nobody")
    expect(info).not.toBeNull()
    expect(info!.myRow).toBeUndefined()
  })

  test("returns null when the page has no ranking table", () => {
    expect(parseLeaderboardHtml("<html><body>empty</body></html>", "tester")).toBeNull()
  })
})

describe("parseLeaderboardJson", () => {
  const leaderboardJson = JSON.stringify({
    data: [
      {
        username: "user-a",
        total_requests: 24535,
        total_tokens_in: 958678572,
        total_tokens_out: 15162237,
        total_tokens: 973840809,
        total_cost: 0,
        total_lines_changed: 9814,
        last_activity: "2026-10-19T06:27:39.399000+00:00",
      },
      {
        username: "tester",
        total_requests: 592,
        total_tokens_in: 81083632,
        total_tokens_out: 445566,
        total_tokens: 81529198,
        total_cost: 0,
        total_lines_changed: 4148,
        last_activity: "2026-10-19T05:49:42.309000+00:00",
      },
    ],
    sort: "total_requests",
    limit: 100,
    statMonth: "2026-10",
    generatedAtDisplay: "2026-10-19 14:00:54 CST",
  })

  test("parses entries, derives rank and matches the current user", () => {
    const info = parseLeaderboardJson(leaderboardJson, "tester")
    expect(info).not.toBeNull()
    expect(info!.period).toBe("2026-10 月度统计")
    expect(info!.generatedAt).toBe("2026-10-19 14:00:54 CST")
    expect(info!.sortKey).toBe("total_requests")
    expect(info!.limit).toBe("100")
    expect(info!.cacheNote).toBe("每小时自动刷新")
    expect(info!.totalRows).toBe(2)

    expect(info!.rows[0].rank).toBe("#1")
    expect(info!.rows[0].username).toBe("user-a")
    expect(info!.rows[0].requestCount).toBe("24535")
    expect(info!.rows[0].tokensPerCodeLine).toBe("99229.8")

    expect(info!.myRow).toBeDefined()
    expect(info!.myRow!.rank).toBe("#2")
    expect(info!.myRow!.username).toBe("tester")
    expect(info!.myRow!.requestCount).toBe("592")
    expect(info!.myRow!.promptTokens).toBe("81083632")
    expect(info!.myRow!.completionTokens).toBe("445566")
    expect(info!.myRow!.totalTokens).toBe("81529198")
    expect(info!.myRow!.codeLines).toBe("4148")
    expect(info!.myRow!.tokensPerCodeLine).toBe("19655.1")
    expect(info!.myRow!.lastActive).toBe("2026-10-19")
  })

  test("leaves myRow undefined when the user is not listed", () => {
    const info = parseLeaderboardJson(leaderboardJson, "nobody")
    expect(info).not.toBeNull()
    expect(info!.myRow).toBeUndefined()
  })

  test("shows an em-dash per-line value when code lines are zero", () => {
    const json = JSON.stringify({
      data: [{ username: "user-a", total_requests: 10, total_tokens: 1000, total_lines_changed: 0 }],
      limit: 100,
    })
    const info = parseLeaderboardJson(json)
    expect(info!.rows[0].tokensPerCodeLine).toBe("—")
    expect(info!.period).toBe("—")
  })

  test("returns null for invalid JSON, non-array data and empty data", () => {
    expect(parseLeaderboardJson("not json")).toBeNull()
    expect(parseLeaderboardJson(JSON.stringify({ data: "nope" }))).toBeNull()
    expect(parseLeaderboardJson(JSON.stringify({ data: [] }))).toBeNull()
    expect(parseLeaderboardJson(JSON.stringify({ data: [{ no_username: true }] }))).toBeNull()
  })
})

describe("formatStatusText", () => {
  const statusData: TeamStatusData = parseTeamUsageHtml(teamUsageHtml)!

  test("renders leaderboard, key usage and team metrics sections", () => {
    const leaderboard = parseLeaderboardHtml(leaderboardHtml, "tester")
    const text = formatStatusText(statusData, leaderboard, "tester")

    expect(text).toContain("统计范围: 2026-10 月度统计")
    expect(text).toContain("额度校验与使用明细更新时间: 2026-10-19 11:30:12 CST")
    expect(text).toContain("用户名: tester")

    expect(text).toContain("── 排行榜（公司） ──")
    expect(text).toContain("排名: #2 / 3")
    expect(text).toContain("请求总数: 502")
    expect(text).toContain("输入 Tokens: 7034.24万 (70342362)")
    expect(text).toContain("输出 Tokens: 32.18万 (321813)")
    expect(text).toContain("总 Tokens: 7066.42万 (70664175)")
    expect(text).toContain("代码处理行数: 2690")
    expect(text).toContain("每行代码消耗 Token: 26269.2")
    expect(text).toContain("最近活跃: 2026-10-16")
    expect(text).toContain("数据口径: 2026-10 月度统计，缓存生成时间 2026-10-19 10:00:50 CST（每 4 小时自动刷新）")

    expect(text).toContain("── 我的 Key 使用 ──")
    expect(text).toContain("Key: tester-key（aaa111…zzz）")
    expect(text).toContain("团队: 中台-测试")
    expect(text).toContain("请求次数: 504")
    expect(text).toContain("总花费: $9.2")
    expect(text).toContain("花费占比: 100%")
    expect(text).toContain("当前额度: $150")
    expect(text).toContain("目标额度: —")
    expect(text).toContain("校验结果: 已达到最高额度")
    expect(text).toContain("Cached Tokens: 6846.03万 (68460267)")
    expect(text).toContain("缓存占比: 97.32%")

    expect(text).toContain("── 团队指标对比 ──")
    expect(text).toContain("团队人数: 25    公司团队平均人数: 11.3")
    expect(text).toContain("团队人均花费: $21.01    公司人均花费: $32.91")
    expect(text).toContain("团队人均token消耗: 1.27亿    公司人均token消耗: 2.25亿")
    expect(text).toContain("统计更新时间: 2026-10-19 11:26:49 CST（每小时自动刷新，团队指标为缓存数据）")
  })

  test("skips the leaderboard cost column (server reports 0.0000 for everyone)", () => {
    const leaderboard = parseLeaderboardHtml(leaderboardHtml, "tester")
    const text = formatStatusText(statusData, leaderboard, "tester")
    expect(text).not.toContain("总成本")
  })

  test("reports when the user is not in the leaderboard top N", () => {
    const leaderboard: LeaderboardInfo = {
      ...parseLeaderboardHtml(leaderboardHtml, "nobody")!,
    }
    const text = formatStatusText(statusData, leaderboard, "nobody")
    expect(text).toContain("排名: 未进入前 100 名（当前榜单共 3 人）")
  })

  test("omits the leaderboard section when leaderboard data is unavailable", () => {
    const text = formatStatusText(statusData, null, "tester")
    expect(text).not.toContain("── 排行榜（公司） ──")
    expect(text).toContain("用户名: tester")
    expect(text).toContain("── 我的 Key 使用 ──")
  })

  test("renders one block per key when multiple keys exist", () => {
    const multiKeyData = parseTeamUsageHtml(multiKeyHtml)!
    const text = formatStatusText(multiKeyData, null, "tester")
    expect(text).toContain("Key: tester-key（aaa111…zzz）")
    expect(text).toContain("Key: second-key（bbb222…yyy）")
    expect(text).toContain("请求次数: —")
    expect(text).toContain("目标额度: $120")
  })
})
