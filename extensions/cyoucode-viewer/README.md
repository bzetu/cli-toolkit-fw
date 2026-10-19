# Cyoucode Viewer extension

查看 Cyoucode 平台所有模型的定价信息与个人使用状态。

- **定价数据**在运行时从 cyou-code VS Code 插件的 `dist/extension.js` 内置 `cyouModels` 表动态提取，无需手动维护。
- **倍率（inputMultiplier）与备注（note）**在运行时从 cyoucode 平台服务器 `GET /api/model-info` 接口实时获取（该接口无需鉴权）。
- **使用状态数据**来源于 cyoucode 平台服务器的两个页面：`GET /team-usage?scope=my-keys`（按 Key 统计的个人使用明细、额度校验、团队指标）和 `GET /leaderboard`（公司排行榜）。两个请求并行发起（各 10 秒超时），从返回的 HTML 中解析数据并以文本输出。

## 命令

```text
/models    显示全部模型定价表
/status    显示个人使用状态与公司排行榜排名（按 Key 的请求次数、花费、额度、团队指标等）
/help      显示命令
/clear     清空输出历史
/exit      返回主页
```

## /models 命令

执行 `/models` 后输出一张包含全部模型的定价表。

### 数据来源

| 数据 | 来源 | 是否需要网络 |
|------|------|------|
| 模型列表、价格、上下文窗口、能力 | 插件 `dist/extension.js` 的 `cyouModels` 表（运行时动态提取） | 否（读取本地插件文件） |
| 倍率（inputMultiplier）、备注（note） | 服务器 `GET /api/model-info`（运行时实时获取，无需鉴权） | 是 |

插件更新后模型列表自动同步，无需手动修改代码。倍率每次执行 `/models` 时从服务器实时获取，反映最新配置。

> **降级行为**：如果插件文件不可读（如插件未安装或路径变更），`/models` 退化为显示内置的 `FALLBACK_MODELS` 上次已知数据；如果服务器不可达，倍率列显示 `—`，价格等其余数据正常显示。

### 定价表列

| 列 | 含义 |
|------|------|
| 模型 | 模型名称 |
| 系列 | GPT / Claude / DeepSeek / GLM / Kimi |
| 输入 | 输入 token 单价（USD / 1M tokens） |
| 输出 | 输出 token 单价（USD / 1M tokens） |
| 缓存写 | 写入缓存单价（Anthropic 系模型才有；GPT 系显示 `—`） |
| 缓存读 | 读取缓存单价（命中缓存时的价格） |
| 上下文 | 上下文窗口大小 |
| 最大输出 | 单次最大输出 token 数 |
| 图像 | `✓` 支持图像输入 / `✗` 不支持 |
| 缓存 | `✓` 支持提示缓存 / `✗` 不支持 |
| 倍率 | 服务器配置的输入倍率（如 `14.71x`）；未配置的模型显示 `—` |
| 备注 | 服务器配置的模型标签（如 `强力且贵`）；未配置的显示 `—` |

### 倍率来源

倍率（inputMultiplier）**不是计算得出的**，而是由 cyoucode 平台服务器通过 `GET /api/model-info` 接口配置并下发的。VS Code 的 cyou-code 插件在运行时获取此数据并在模型下拉菜单旁显示为徽章。

服务器地址从 `~/.cyoucode/cyou_auth.json` 的 `server_url` 字段读取（仅读取服务器地址，不读取 access_token）。如果该文件不存在或服务器不可达，倍率列显示 `—`。

## /status 命令

执行 `/status` 后并行请求 cyoucode 平台服务器的两个页面（各 10 秒超时），解析返回的 HTML 并以文本形式输出：

- `GET {server_url}/team-usage?token={access_token}&scope=my-keys` — **主数据源**（必需）。页面为"按 Key"口径：包含"我的 Key"列表、额度提升校验、按 Key 的使用明细和团队指标对比。
- `GET {server_url}/leaderboard?token={access_token}` — **辅助数据源**（可选）。公司排行榜（按请求总数排序，前 100 名），用于展示当前用户的排名、请求总数、输入/输出 Tokens、最近活跃等。

如果排行榜请求失败或解析失败，仍会输出 team-usage 部分的数据，并在末尾附上 `（排行榜数据获取失败：…）` 提示；如果 team-usage 请求失败，则直接返回错误提示。

> 旧版实现先调用 `POST /api/team-usage/refresh-details` 刷新接口再回退缓存页。该接口已失效（请求长期挂起无响应），现已移除，改为直接读取 `team-usage` 页面（每小时自动刷新）。

### 数据来源

1. 从 `~/.cyoucode/cyou_auth.json` 读取 `access_token`、`server_url` 和 `username`。
2. 并行请求 `GET {server_url}/team-usage?token={access_token}&scope=my-keys` 和 `GET {server_url}/leaderboard?token={access_token}`（各 10 秒超时）。
3. 从 team-usage 页面解析四个数据块（按掩码后的 API Key 关联合并）：
   - **页面元信息**：统计范围、统计更新时间
   - **我的 Key 表**（my-keys-table）：Key 名称、绑定团队、来源、添加时间
   - **额度提升校验表**（budget-upgrade-table）：按 Key 的当前额度、目标额度、校验结果
   - **使用明细表**（usage-detail-table，15 列）：按 Key 的请求次数、总花费、Tokens 明细等
   - **团队指标参考表**（无 ID）：团队人数、人均 API 花费、人均 Token 消耗（本团队 vs 团队平均）
4. 从 leaderboard 页面解析排行榜表（排名、用户名、请求总数、输入/输出/总 Tokens、代码处理行数、每行代码消耗 Token、最近活跃），并按 `username` 匹配当前用户的行。

> 排行榜页的"总成本 (USD)"列目前对所有人显示 `0.0000`（服务端未填充），输出中跳过该列，花费以 team-usage 页的按 Key 明细为准。

### Token 数字格式

Token 计数使用中文单位显示：

- **1万以下**：显示原数据（如 `3386`）
- **1万 ~ 1亿**：显示 `X.XX万 (原数据)`（如 `108.49万 (1084862)`）
- **1亿以上**：显示 `X.XX亿 (原数据)`（如 `1.61亿 (161399925)`）

团队指标对比部分省略括号中的原数据，仅显示单位（如 `1.29亿 (平均: 2.27亿)`）。

### 输出示例

```text
统计范围: 2026-10 月度统计
统计更新时间: 2026-10-19 11:26:49 CST

用户名: jiangcheng_m

── 排行榜（公司） ──
排名: #75 / 100
请求总数: 502
输入 Tokens: 7034.24万 (70342362)
输出 Tokens: 32.18万 (321813)
总 Tokens: 7066.42万 (70664175)
代码处理行数: 2690
每行代码消耗 Token: 26269.2
最近活跃: 2026-10-16
数据口径: 2026-10 月度统计，缓存生成时间 2026-10-19 10:00:50 CST

── 我的 Key 使用 ──
Key: mm-蒋程（48d771…fdc1）
团队: 中台-平台
请求次数: 504
总花费: $9.2
花费占比: 100%
当前额度: $150
目标额度: —
校验结果: 已达到最高额度
总 Tokens: 7066.42万 (70664175)
Prompt Tokens: 7034.24万 (70342362)
Completion Tokens: 32.18万 (321813)
Cached Tokens: 6846.03万 (68460267)
缓存占比: 97.32%
平均请求长度: 139,568.18
超长请求数: 0
代码处理行数: 2690

── 团队指标对比 ──
团队人数: 25    公司团队平均人数: 11.3
团队人均花费: $21.01    公司人均花费: $32.91
团队人均token消耗: 1.27亿    公司人均token消耗: 2.25亿
```

多个 Key 时，"我的 Key 使用"部分会为每个 Key 输出一个独立的数据块。

### Token 读取

认证信息从 `~/.cyoucode/cyou_auth.json` 读取，包含：

| 字段 | 用途 |
|------|------|
| `access_token` | 请求 `/team-usage` 和 `/leaderboard` 的查询参数 `token` |
| `server_url` | 服务器地址（如 `http://10.1.10.42:5001`） |
| `username` | 用于在 `/leaderboard` 排行榜中匹配当前用户的行 |

### 错误提示

`/status` 会在请求失败时给出针对性的提示，便于定位问题：

| 场景 | 提示 |
|------|------|
| token 已过期（本地 `expires_at` 已过） | `认证已过期（…），请在 cyoucode 客户端重新登录` |
| 服务器返回 HTTP 401/403 | `认证失败 (HTTP 401)，认证已过期，请在 cyoucode 客户端重新登录` |
| 请求超时（服务器未及时响应） | `获取数据超时（服务器未及时响应），请稍后重试` |
| DNS 解析失败（未连内网/VPN） | `无法解析服务器地址（DNS 失败），请检查是否已连接内网/VPN` |
| 连接被拒绝 | `服务器拒绝连接（可能未联网或服务不可用），请检查内网连接` |
| 连接被重置 | `连接被重置，请检查网络连接后重试` |
| 其他网络错误 | `网络错误 (错误码)，请检查网络连接` |
| 排行榜请求失败（team-usage 正常） | 正常输出其余数据，末尾附 `（排行榜数据获取失败：…）` |

Token 会过期（`expires_at` 字段），过期后需在 cyoucode 客户端重新登录。

## 技术实现

### 动态提取流程

`/models` 执行时：

1. **查找插件**：扫描 `~/.vscode/extensions/` 下 `cyouinc.cyou-code-*` 目录，取版本号最高的。
2. **提取 cyouModels**：读取 `dist/extension.js`，定位 `gpt52LikeModel` 和 `cyouModels` 定义段，用 `new Function()` 在沙箱中执行以解析 spread（`...gpt52LikeModel`）和科学计数法（`128e3`、`3625e-6`）。
3. **映射**：将插件原始字段名映射为 `ModelInfo` 类型（如 `maxTokens` → `maxOutputTokens`、`supportsPromptCache` → `supportsCache`、`cacheReadsPrice` → `cacheReadPrice`），根据模型名推断系列（`gpt-*` → GPT 等）。
4. **获取倍率**：从 `~/.cyoucode/cyou_auth.json` 读取 `server_url`，请求 `GET /api/model-info`，将返回的 `{ id, inputMultiplier, note }` 合并到对应模型。
5. **缓存**：插件提取结果在模块级缓存（按插件目录名），倍率每次实时获取。

### 降级数据

`models.ts` 内置 `FALLBACK_MODELS`（v0.36.8 快照，2026-09-15 提取），仅在插件文件不可读时使用。正常运行时，所有数据均来自插件和服务器的实时值。

## 无网络访问

`/models` 命令的**价格数据**从本地插件文件读取，不需要网络连接。**倍率数据**需要访问 cyoucode 平台服务器（内网）；如果服务器不可达，倍率列显示 `—`，不影响价格数据展示。不读取任何凭据中的 token 字段。

`/status` 命令需要网络连接（访问 cyoucode 平台服务器），并读取 `~/.cyoucode/cyou_auth.json` 中的认证信息。
