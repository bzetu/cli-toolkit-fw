import { describe, expect, test } from "bun:test"
import { parseTeamUsageHtml, formatStatusText, formatTokenCount, describeFetchError, expiredTokenMessage, type TeamStatusData } from "../status"

const sampleHtml = `<!doctype html>
<html>
<head><title>Cyou AI</title></head>
<body>
  <div class="meta-item">
    <span>统计范围</span>
    <strong>2026-09 月度统计</strong>
  </div>
  <div class="meta-item">
    <span>使用明细记录</span>
    <strong>1</strong>
  </div>
  <div class="meta-item">
    <span>统计更新时间（每小时自动刷新）</span>
    <strong>2026-09-10 09:51:46 CST</strong>
  </div>

  <table id="budget-upgrade-table">
    <thead><tr>
      <th>成员</th><th>API Key</th><th>当前额度（$）</th><th>本月花费（$）</th>
      <th>本月缓存占比</th><th>本月代码行数</th><th>目标额度（$）</th>
      <th>校验结果</th><th>操作</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>jiangcheng_m</td>
        <td>48d771…fdc1mm-蒋程</td>
        <td>120</td>
        <td>87.48</td>
        <td>91.26%</td>
        <td>3386</td>
        <td>150</td>
        <td>本月花费需达到 $110</td>
        <td>申请提升至 $150</td>
      </tr>
    </tbody>
  </table>

  <table id="usage-detail-table">
    <thead><tr>
      <th>排名</th><th>用户名</th><th>团队</th><th>请求次数</th><th>总花费（$）</th>
      <th>花费占比</th><th>总 Tokens(个)</th><th>Prompt Tokens</th>
      <th>平均请求长度</th><th>Completion Tokens</th><th>Cached Tokens</th>
      <th>缓存占比</th><th>超长请求数</th><th>代码处理行数</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>1</td><td>jiangcheng_m</td><td>中台-平台</td><td>1579</td>
        <td>87.48</td><td>17.17%</td><td>158737870</td><td>157689359</td>
        <td>99,866.6</td><td>1048511</td><td>143905426</td><td>91.26%</td>
        <td>0</td><td>3386</td>
      </tr>
    </tbody>
  </table>

  <section class="team-metric-comparison-section">
    <table class="data-table">
      <thead><tr>
        <th>指标</th><th>本团队（中台-平台）</th><th>团队平均</th>
      </tr></thead>
      <tbody>
        <tr><td>团队人数</td><td>24</td><td>11</td></tr>
        <tr><td>每千行代码Token消耗</td><td>45,208,509.39</td><td>53,078,949.57</td></tr>
        <tr><td>人均代码处理行数</td><td>2,814.21</td><td>4,498.91</td></tr>
        <tr><td>代码处理行数</td><td>67541</td><td>60,686</td></tr>
        <tr><td>人均token消耗</td><td>127,226,163.88</td><td>224,774,657.05</td></tr>
        <tr><td>人均API花费（$）</td><td>21.01</td><td>32.91</td></tr>
        <tr><td>请求次数</td><td>21000</td><td>16,528</td></tr>
        <tr><td>总花费（$）</td><td>504.28</td><td>305.3</td></tr>
        <tr><td>团队预算（$）</td><td>2,293</td><td>997.37</td></tr>
        <tr><td>额度使用率</td><td>21.99%</td><td>29.23%</td></tr>
        <tr><td>总 Tokens(个)</td><td>3053427933</td><td>2,318,349,662</td></tr>
        <tr><td>平均请求长度</td><td>144,563.88</td><td>124,477.51</td></tr>
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
  test("extracts all fields from sample HTML", () => {
    const data = parseTeamUsageHtml(sampleHtml, "jiangcheng_m")
    expect(data).not.toBeNull()
    expect(data!.updateTime).toBe("2026-09-10 09:51:46 CST")
    expect(data!.period).toBe("2026-09 月度统计")
    expect(data!.username).toBe("jiangcheng_m")
    expect(data!.team).toBe("中台-平台")
    expect(data!.rank).toBe("1")
    expect(data!.requestCount).toBe("1579")
    expect(data!.totalCost).toBe("87.48")
    expect(data!.costRatio).toBe("17.17%")
    expect(data!.totalTokens).toBe("158737870")
    expect(data!.promptTokens).toBe("157689359")
    expect(data!.avgRequestLength).toBe("99,866.6")
    expect(data!.completionTokens).toBe("1048511")
    expect(data!.cachedTokens).toBe("143905426")
    expect(data!.cacheRatio).toBe("91.26%")
    expect(data!.longRequestCount).toBe("0")
    expect(data!.codeLines).toBe("3386")
    expect(data!.currentBudget).toBe("120")
    expect(data!.targetBudget).toBe("150")
    expect(data!.validationResult).toBe("本月花费需达到 $110")
  })

  test("extracts team metrics from sample HTML", () => {
    const data = parseTeamUsageHtml(sampleHtml, "jiangcheng_m")
    expect(data).not.toBeNull()
    expect(data!.teamMetrics).not.toBeNull()
    expect(data!.teamMetrics!.teamMembers).toBe("24")
    expect(data!.teamMetrics!.avgTeamMembers).toBe("11")
    expect(data!.teamMetrics!.perCapitaCost).toBe("21.01")
    expect(data!.teamMetrics!.avgPerCapitaCost).toBe("32.91")
    expect(data!.teamMetrics!.perCapitaTokens).toBe("127,226,163.88")
    expect(data!.teamMetrics!.avgPerCapitaTokens).toBe("224,774,657.05")
  })

  test("returns null when usage-detail-table is missing", () => {
    const html = "<html><body><div>no tables here</div></body></html>"
    expect(parseTeamUsageHtml(html)).toBeNull()
  })

  test("uses first row when username not specified", () => {
    const data = parseTeamUsageHtml(sampleHtml)
    expect(data).not.toBeNull()
    expect(data!.username).toBe("jiangcheng_m")
  })

  test("falls back to first row when username not found", () => {
    const data = parseTeamUsageHtml(sampleHtml, "nonexistent_user")
    expect(data).not.toBeNull()
    expect(data!.username).toBe("jiangcheng_m")
  })

  test("returns default em-dash when meta items are missing", () => {
    const minimalHtml = `
      <table id="budget-upgrade-table"><tbody>
        <tr><td>user1</td><td>key</td><td>100</td><td>50</td><td>80%</td><td>1000</td><td>200</td><td>OK</td><td>btn</td></tr>
      </tbody></table>
      <table id="usage-detail-table"><tbody>
        <tr><td>1</td><td>user1</td><td>team1</td><td>500</td><td>50.00</td><td>10%</td><td>1000000</td><td>900000</td><td>2000</td><td>100000</td><td>800000</td><td>80%</td><td>5</td><td>2000</td></tr>
      </tbody></table>
    `
    const data = parseTeamUsageHtml(minimalHtml)
    expect(data).not.toBeNull()
    expect(data!.updateTime).toBe("—")
    expect(data!.period).toBe("—")
    expect(data!.username).toBe("user1")
    expect(data!.currentBudget).toBe("100")
    expect(data!.targetBudget).toBe("200")
    expect(data!.validationResult).toBe("OK")
    expect(data!.teamMetrics).toBeUndefined()
  })
})

describe("formatStatusText", () => {
  test("formats data as readable text with all fields", () => {
    const data: TeamStatusData = {
      updateTime: "2026-09-10 09:51:46 CST",
      period: "2026-09 月度统计",
      username: "jiangcheng_m",
      team: "中台-平台",
      rank: "1",
      requestCount: "1579",
      totalCost: "87.48",
      costRatio: "17.17%",
      totalTokens: "158737870",
      promptTokens: "157689359",
      avgRequestLength: "99,866.6",
      completionTokens: "1048511",
      cachedTokens: "143905426",
      cacheRatio: "91.26%",
      longRequestCount: "0",
      codeLines: "3386",
      currentBudget: "120",
      targetBudget: "150",
      validationResult: "本月花费需达到 $110",
    }
    const text = formatStatusText(data)
    expect(text).toContain("统计范围: 2026-09 月度统计")
    expect(text).toContain("统计更新时间: 2026-09-10 09:51:46 CST")
    expect(text).toContain("用户名: jiangcheng_m")
    expect(text).toContain("团队: 中台-平台")
    expect(text).toContain("排名: 1")
    expect(text).toContain("请求次数: 1579")
    expect(text).toContain("总花费: $87.48")
    expect(text).toContain("花费占比: 17.17%")
    expect(text).toContain("当前额度: $120")
    expect(text).toContain("目标额度: $150")
    expect(text).toContain("校验结果: 本月花费需达到 $110")
    // Token counts are formatted with Chinese units
    expect(text).toContain("总 Tokens: 1.59亿 (158737870)")
    expect(text).toContain("Prompt Tokens: 1.58亿 (157689359)")
    expect(text).toContain("Completion Tokens: 104.85万 (1048511)")
    expect(text).toContain("Cached Tokens: 1.44亿 (143905426)")
    expect(text).toContain("缓存占比: 91.26%")
    expect(text).toContain("平均请求长度: 99,866.6")
    expect(text).toContain("超长请求数: 0")
    expect(text).toContain("代码处理行数: 3386")
  })

  test("includes team metrics section when present", () => {
    const data: TeamStatusData = {
      updateTime: "2026-09-10 09:51:46 CST",
      period: "2026-09 月度统计",
      username: "jiangcheng_m",
      team: "中台-平台",
      rank: "1",
      requestCount: "1579",
      totalCost: "87.48",
      costRatio: "17.17%",
      totalTokens: "158737870",
      promptTokens: "157689359",
      avgRequestLength: "99,866.6",
      completionTokens: "1048511",
      cachedTokens: "143905426",
      cacheRatio: "91.26%",
      longRequestCount: "0",
      codeLines: "3386",
      currentBudget: "120",
      targetBudget: "150",
      validationResult: "本月花费需达到 $110",
      teamMetrics: {
        teamMembers: "24",
        avgTeamMembers: "11",
        perCapitaCost: "21.01",
        avgPerCapitaCost: "32.91",
        perCapitaTokens: "127,226,163.88",
        avgPerCapitaTokens: "224,774,657.05",
      },
    }
    const text = formatStatusText(data)
    expect(text).toContain("团队人数: 24    公司团队平均人数: 11")
    
    expect(text).toContain("团队人均花费: $21.01    公司人均花费: $32.91")
    expect(text).toContain("团队人均token消耗: 1.27亿    公司人均token消耗: 2.25亿")
  })

  test("omits team metrics section when absent", () => {
    const data: TeamStatusData = {
      updateTime: "2026-09-10 09:51:46 CST",
      period: "2026-09 月度统计",
      username: "jiangcheng_m",
      team: "中台-平台",
      rank: "1",
      requestCount: "1579",
      totalCost: "87.48",
      costRatio: "17.17%",
      totalTokens: "158737870",
      promptTokens: "157689359",
      avgRequestLength: "99,866.6",
      completionTokens: "1048511",
      cachedTokens: "143905426",
      cacheRatio: "91.26%",
      longRequestCount: "0",
      codeLines: "3386",
      currentBudget: "120",
      targetBudget: "150",
      validationResult: "本月花费需达到 $110",
    }
    const text = formatStatusText(data)
    expect(text).not.toContain("团队人数")
    expect(text).not.toContain("团队人均花费")
    expect(text).not.toContain("团队人均token消耗")
  })
})
