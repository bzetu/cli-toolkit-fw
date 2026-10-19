# Cyoucode Viewer extension

查看 Cyoucode 平台所有模型的定价信息与个人使用状态。

- **定价数据**在运行时从 cyou-code VS Code 插件的 `dist/extension.js` 内置 `cyouModels` 表动态提取，无需手动维护。
- **倍率（inputMultiplier）与备注（note）**在运行时从 cyoucode 平台服务器 `GET /api/model-info` 接口实时获取（该接口无需鉴权）。
- **使用状态数据**来源于 cyoucode 平台服务器。优先调用 `POST /api/team-usage/refresh-details` 接口获取最新数据（8 秒超时）；如果该接口无响应或超时，自动回退到 `GET /team-usage` 页面获取每小时自动刷新的缓存数据。从返回的 HTML 页面中解析使用明细、额度校验、团队指标等信息。

## 命令

```text
/models    显示全部模型定价表
/status    显示个人使用状态（请求次数、花费、额度、团队指标等）
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

执行 `/status` 后向 cyoucode 平台服务器请求数据：优先调用刷新接口获取最新数据（8 秒超时），如果超时或失败则自动回退到缓存页面（每小时自动刷新），从返回的 HTML 中解析个人使用状态数据并以文本形式输出。

### 数据来源

1. 从 `~/.cyoucode/cyou_auth.json` 读取 `access_token`、`server_url` 和 `username`。
2. 优先 `POST {server_url}/api/team-usage/refresh-details?token={access_token}` — 触发数据刷新，返回包含最新数据的 HTML 页面（8 秒超时）。
3. 如果刷新接口超时或失败，回退到 `GET {server_url}/team-usage?token={access_token}` — 获取每小时自动刷新的缓存页面（10 秒超时）。
3. 从返回的 HTML 中解析三个数据块：
   - **页面元信息**：统计范围、统计更新时间
   - **额度提升校验表**（budget-upgrade-table）：当前额度、目标额度、校验结果
   - **使用明细表**（usage-detail-table）：请求次数、总花费、Tokens 明细等
   - **团队指标参考表**（无 ID）：团队人数、人均 API 花费、人均 Token 消耗（本团队 vs 团队平均）

### Token 数字格式

Token 计数使用中文单位显示：

- **1万以下**：显示原数据（如 `3386`）
- **1万 ~ 1亿**：显示 `X.XX万 (原数据)`（如 `108.49万 (1084862)`）
- **1亿以上**：显示 `X.XX亿 (原数据)`（如 `1.61亿 (161399925)`）

团队指标对比部分省略括号中的原数据，仅显示单位（如 `1.29亿 (平均: 2.27亿)`）。

### 输出示例

```text
统计范围: 2026-09 月度统计
统计更新时间: 2026-09-10 10:53:33 CST

用户名: jiangcheng_m
团队: 中台-平台
排名: 1
请求次数: 1602
总花费: $87.88
花费占比: 16.93%
当前额度: $120
目标额度: $150
校验结果: 本月花费需达到 $110

总 Tokens: 1.61亿 (161399925)
Prompt Tokens: 1.60亿 (160315063)
Completion Tokens: 108.49万 (1084862)
Cached Tokens: 1.46亿 (146405266)
缓存占比: 91.32%
平均请求长度: 100,071.82
超长请求数: 0
代码处理行数: 4419

团队人数: 24    公司团队平均人数: 11
团队人均花费: $21.39    公司人均花费: $33.38
团队人均token消耗: 1.29亿    公司人均token消耗: 2.27亿
```

### Token 读取

认证信息从 `~/.cyoucode/cyou_auth.json` 读取，包含：

| 字段 | 用途 |
|------|------|
| `access_token` | 请求 `/api/team-usage/refresh-details` 和 `/team-usage` 的查询参数 `token` |
| `server_url` | 服务器地址（如 `http://10.1.10.42:5001`） |
| `username` | 用于从使用明细表中筛选当前用户的数据行 |

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
