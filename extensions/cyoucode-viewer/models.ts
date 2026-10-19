import { formatTable } from "../../src/core/table"
import { readFileSync } from "node:fs"
import { readdirSync } from "node:fs"
import path from "node:path"
import { homedir } from "node:os"

/** Model series available through the Cyoucode router. */
export type ModelSeries = "GPT" | "Claude" | "DeepSeek" | "GLM" | "Kimi"

/** A pricing tier (e.g. flex, priority) that overrides default prices. */
export type PricingTier = {
  name?: string
  contextWindow?: number
  inputPrice?: number
  outputPrice?: number
  cacheWritesPrice?: number
  cacheReadsPrice?: number
}

/** Long-context surcharge rule. */
export type LongContextPricing = {
  thresholdTokens: number
  inputPriceMultiplier: number
  outputPriceMultiplier: number
  appliesToServiceTiers?: string[]
}

/** Complete model information for display.
 *  Price/capability data is extracted at runtime from the cyou-code plugin's
 *  `cyouModels` table in `dist/extension.js`.
 *  Multiplier (`inputMultiplier`) and `note` are fetched live from the
 *  cyoucode platform server's `/api/model-info` endpoint (no auth required).
 *  All prices are in USD per 1 million tokens. */
export type ModelInfo = {
  name: string
  series: ModelSeries
  description: string
  inputPrice: number
  outputPrice: number
  /** Write-cache price (Anthropic-style). Absent for GPT models. */
  cacheWritePrice?: number
  /** Read-cache (cache-hit) price. */
  cacheReadPrice?: number
  /** Total context window in tokens. */
  contextWindow: number
  /** Single-call maximum output tokens. */
  maxOutputTokens?: number
  /** Whether the model accepts image input (vision). */
  supportsImages: boolean
  /** Whether the model supports prompt caching. */
  supportsCache: boolean
  /** Supported reasoning-effort levels. */
  supportsReasoningEffort?: string[]
  /** Default reasoning-effort level. */
  reasoningEffort?: string
  /** Prompt-cache retention time (e.g. "24h", "30m"). */
  promptCacheRetention?: string
  promptCacheTtl?: string
  /** Service tiers with price overrides (flex/priority). */
  tiers?: PricingTier[]
  /** Long-context surcharge rule. */
  longContextPricing?: LongContextPricing
  /** Server-configured cost multiplier shown in the cyou-code UI (e.g. "14.71x").
   *  Fetched live from GET <server>/api/model-info. */
  inputMultiplier?: string
  /** Server-configured label/note shown alongside the multiplier (e.g. "强力且贵").
   *  Fetched live from GET <server>/api/model-info. */
  note?: string
}

/** Raw model object shape inside the plugin's `cyouModels` table.
 *  Only the fields we extract are listed; unknown fields are ignored. */
type RawModel = {
  maxTokens?: number
  contextWindow: number
  supportsImages: boolean
  supportsPromptCache: boolean
  promptCacheRetention?: string
  promptCacheTtl?: string
  supportsReasoningEffort?: string[]
  reasoningEffort?: string
  inputPrice: number
  outputPrice: number
  cacheWritesPrice?: number
  cacheReadsPrice?: number
  tiers?: Array<{
    name?: string
    contextWindow?: number
    inputPrice?: number
    outputPrice?: number
    cacheWritesPrice?: number
    cacheReadsPrice?: number
  }>
  longContextPricing?: LongContextPricing
  description: string
}

// ── Dynamic loading from the plugin ──

/** Find the latest installed cyou-code plugin directory under ~/.vscode/extensions.
 *  Returns the absolute path, or null if no plugin is installed. */
function findPluginDir(): string | null {
  const extDir = path.join(homedir(), ".vscode", "extensions")
  let dirs: string[]
  try {
    dirs = readdirSync(extDir).filter((d) => d.startsWith("cyouinc.cyou-code-"))
  } catch {
    return null
  }
  if (dirs.length === 0) return null
  // Sort by version number (semver-ish); the last entry is the newest.
  dirs.sort()
  return path.join(extDir, dirs[dirs.length - 1])
}

/** Extract the `cyouModels` object from the plugin's bundled extension.js.
 *  Reads the file, locates the `gpt52LikeModel` and `cyouModels` definitions,
 *  and evaluates them in a sandboxed Function to resolve spreads and
 *  scientific-notation literals (e.g. 128e3, 3625e-6).
 *  Returns the raw object, or null if the plugin or definitions are not found. */
function extractRawCyouModels(): Record<string, RawModel> | null {
  const pluginDir = findPluginDir()
  if (!pluginDir) return null

  const extJs = path.join(pluginDir, "dist", "extension.js")
  let content: string
  try {
    content = readFileSync(extJs, "utf-8")
  } catch {
    return null
  }

  const gptStart = content.indexOf("gpt52LikeModel = {")
  const cyouEnd = content.indexOf("isCyouModelId = ")
  if (gptStart < 0 || cyouEnd < 0 || cyouEnd <= gptStart) return null

  const code = content.substring(gptStart, cyouEnd)
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(code + "\nreturn cyouModels;")
    const result = fn() as Record<string, RawModel>
    if (result && typeof result === "object") return result
    return null
  } catch {
    return null
  }
}

/** Infer the model series from its name. */
export function inferSeries(name: string): ModelSeries {
  if (name.startsWith("gpt")) return "GPT"
  if (name.startsWith("claude")) return "Claude"
  if (name.startsWith("deepseek")) return "DeepSeek"
  if (name.startsWith("glm")) return "GLM"
  if (name.startsWith("kimi")) return "Kimi"
  return "GPT" // fallback; all cyoucode models are one of the above
}

/** Map a raw plugin model object to the display ModelInfo shape. */
export function mapToModelInfo(name: string, raw: RawModel): ModelInfo {
  return {
    name,
    series: inferSeries(name),
    description: raw.description,
    inputPrice: raw.inputPrice,
    outputPrice: raw.outputPrice,
    cacheWritePrice: raw.cacheWritesPrice,
    cacheReadPrice: raw.cacheReadsPrice,
    contextWindow: raw.contextWindow,
    maxOutputTokens: raw.maxTokens,
    supportsImages: raw.supportsImages,
    supportsCache: raw.supportsPromptCache,
    supportsReasoningEffort: raw.supportsReasoningEffort,
    reasoningEffort: raw.reasoningEffort,
    promptCacheRetention: raw.promptCacheRetention,
    promptCacheTtl: raw.promptCacheTtl,
    tiers: raw.tiers?.map((t) => ({
      name: t.name,
      contextWindow: t.contextWindow,
      inputPrice: t.inputPrice,
      outputPrice: t.outputPrice,
      cacheWritesPrice: t.cacheWritesPrice,
      cacheReadsPrice: t.cacheReadsPrice,
    })),
    longContextPricing: raw.longContextPricing,
  }
}

/** Read the server URL from ~/.cyoucode/cyou_auth.json.
 *  Only the server_url field is needed; the token is not read.
 *  Returns null if the file is missing or unreadable. */
function readServerUrl(): string | null {
  try {
    const raw = readFileSync(path.join(homedir(), ".cyoucode", "cyou_auth.json"), "utf-8")
    const auth = JSON.parse(raw) as { server_url?: string }
    return auth.server_url ?? null
  } catch {
    return null
  }
}

/** Fetch model multipliers and notes from the cyoucode platform server.
 *  The `/api/model-info` endpoint is public (no auth token required).
 *  Returns a Map keyed by model id, or an empty Map on failure. */
async function fetchMultipliers(): Promise<Map<string, { multiplier: string; note: string }>> {
  const serverUrl = readServerUrl()
  if (!serverUrl) return new Map()

  try {
    const response = await fetch(`${serverUrl}/api/model-info`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return new Map()
    const data = (await response.json()) as {
      models: Array<{ id: string; inputMultiplier: string; note: string }>
    }
    const map = new Map<string, { multiplier: string; note: string }>()
    for (const m of data.models) {
      map.set(m.id, { multiplier: m.inputMultiplier, note: m.note })
    }
    return map
  } catch {
    return new Map()
  }
}

// ── Cached plugin data + live multiplier fetch ──

let _cachedPluginModels: ModelInfo[] | null = null

/** Load model data: prices/capabilities from the plugin (cached) +
 *  multipliers/notes from the server (fresh each call).
 *  Falls back to FALLBACK_MODELS if the plugin cannot be read.
 *  Multiplier/note fields are left unset (shown as "—") if the
 *  server is unreachable. */
export async function loadModels(): Promise<ModelInfo[]> {
  // 1. Extract plugin data (cached after first call)
  if (!_cachedPluginModels) {
    const raw = extractRawCyouModels()
    _cachedPluginModels = raw
      ? Object.entries(raw).map(([name, r]) => mapToModelInfo(name, r))
      : FALLBACK_MODELS
  }

  // 2. Fetch multipliers fresh each time (user-triggered, low frequency)
  const multipliers = await fetchMultipliers()

  // 3. Merge — never mutate the cached array
  return _cachedPluginModels.map((model) => {
    const m = multipliers.get(model.name)
    return m ? { ...model, inputMultiplier: m.multiplier, note: m.note } : model
  })
}

// ── Formatting helpers ──

/** Format a unit price for display.
 *  Prices with ≤ 2 decimal places get exactly 2; others keep natural precision. */
export function formatPrice(price: number | undefined): string {
  if (price === undefined) return "—"
  const decimals = (price.toString().split(".")[1] ?? "").length
  if (decimals <= 2) return price.toFixed(2)
  return String(price)
}

/** Format a context-window token count as a compact human-readable string. */
export function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000
    return Number.isInteger(millions) ? `${millions}M` : `${millions.toFixed(1)}M`
  }
  return `${Math.round(tokens / 1000)}k`
}

/** Return the server-configured cost multiplier (倍率) for a model.
 *  Returns "—" for models not present in the server response. */
export function modelMultiplier(model: ModelInfo): string {
  return model.inputMultiplier ?? "—"
}

/** Render the full model pricing table (all models in one table). */
export function formatModelsTable(models: ModelInfo[] = FALLBACK_MODELS): string {
  const rows = models.map((model) => [
    model.name,
    model.series,
    formatPrice(model.inputPrice),
    formatPrice(model.outputPrice),
    formatPrice(model.cacheWritePrice),
    formatPrice(model.cacheReadPrice),
    formatContext(model.contextWindow),
    model.maxOutputTokens !== undefined ? formatContext(model.maxOutputTokens) : "—",
    model.supportsImages ? "✓" : "✗",
    model.supportsCache ? "✓" : "✗",
    modelMultiplier(model),
    model.note ?? "—",
  ])

  return formatTable(
    ["模型", "系列", "输入", "输出", "缓存写", "缓存读", "上下文", "最大输出", "图像", "缓存", "倍率", "备注"],
    rows,
  )
}

// ── Fallback data (used when the plugin cannot be read) ──
/** Last-known model data extracted from the cyou-code plugin v0.36.8
 *  (2026-09-15). Used as a fallback when the plugin file cannot be read
 *  at runtime. In normal operation, loadModels() extracts fresh data
 *  from the installed plugin instead. */
export const FALLBACK_MODELS: ModelInfo[] = [
  {
    name: "gpt-5.3-codex", series: "GPT", description: "GPT-5.3 Codex for Cyou Code Router",
    inputPrice: 1.75, outputPrice: 14, cacheReadPrice: 0.175,
    contextWindow: 400_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["low", "medium", "high", "xhigh"], reasoningEffort: "medium",
    promptCacheRetention: "24h",
    tiers: [{ name: "priority", contextWindow: 400_000, inputPrice: 3.5, outputPrice: 28, cacheReadsPrice: 0.35 }],
  },
  {
    name: "gpt-5.4", series: "GPT", description: "GPT-5.4 for Cyou Code Router",
    inputPrice: 2.5, outputPrice: 15, cacheReadPrice: 0.25,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high", "xhigh"], reasoningEffort: "none",
    longContextPricing: { thresholdTokens: 272_000, inputPriceMultiplier: 2, outputPriceMultiplier: 1.5, appliesToServiceTiers: ["default", "flex"] },
    tiers: [
      { name: "flex", contextWindow: 1_050_000, inputPrice: 1.25, outputPrice: 7.5, cacheReadsPrice: 0.125 },
      { name: "priority", contextWindow: 1_050_000, inputPrice: 5, outputPrice: 30, cacheReadsPrice: 0.5 },
    ],
  },
  {
    name: "gpt-5.5", series: "GPT", description: "GPT-5.5 for Cyou Code Router",
    inputPrice: 5, outputPrice: 30, cacheReadPrice: 0.5,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high", "xhigh"], reasoningEffort: "none",
    longContextPricing: { thresholdTokens: 272_000, inputPriceMultiplier: 2, outputPriceMultiplier: 1.5, appliesToServiceTiers: ["default", "flex"] },
    tiers: [
      { name: "flex", contextWindow: 1_050_000, inputPrice: 2.5, outputPrice: 15, cacheReadsPrice: 0.25 },
      { name: "priority", contextWindow: 1_050_000, inputPrice: 10, outputPrice: 60, cacheReadsPrice: 1 },
    ],
  },
  {
    name: "gpt-5.6-luna", series: "GPT", description: "GPT-5.6 Luna for Cyou Code Router",
    inputPrice: 1, outputPrice: 6, cacheReadPrice: 0.1,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["low", "medium", "high", "xhigh", "max"], reasoningEffort: "medium",
    promptCacheTtl: "30m",
  },
  {
    name: "gpt-5.6-terra", series: "GPT", description: "GPT-5.6 Terra for Cyou Code Router",
    inputPrice: 2.5, outputPrice: 15, cacheReadPrice: 0.25,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["low", "medium", "high", "xhigh", "max", "ultra"], reasoningEffort: "medium",
    promptCacheTtl: "30m",
  },
  {
    name: "gpt-5.6-sol", series: "GPT", description: "GPT-5.6 Sol for Cyou Code Router",
    inputPrice: 5, outputPrice: 30, cacheReadPrice: 0.5,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["low", "medium", "high", "xhigh", "max", "ultra"], reasoningEffort: "medium",
    promptCacheTtl: "30m",
  },
  {
    name: "gpt-6-astra", series: "GPT", description: "GPT-6 Astra for Cyou Code Router",
    inputPrice: 10, outputPrice: 60, cacheReadPrice: 1,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["low", "medium", "high", "xhigh", "max", "ultra"], reasoningEffort: "medium",
    promptCacheTtl: "30m",
  },
  {
    name: "gpt-5.4-mini", series: "GPT", description: "GPT-5.4 Mini for Cyou Code Router",
    inputPrice: 0.75, outputPrice: 4.5, cacheReadPrice: 0.075,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high", "xhigh"], reasoningEffort: "none",
    tiers: [
      { name: "flex", contextWindow: 400_000, inputPrice: 0.375, outputPrice: 2.25, cacheReadsPrice: 0.0375 },
      { name: "priority", contextWindow: 400_000, inputPrice: 1.5, outputPrice: 9, cacheReadsPrice: 0.15 },
    ],
  },
  {
    name: "gpt-5.2", series: "GPT", description: "GPT-5.2 for Cyou Code Router",
    inputPrice: 1.75, outputPrice: 14, cacheReadPrice: 0.175,
    contextWindow: 400_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high", "xhigh"], reasoningEffort: "medium",
    promptCacheRetention: "24h",
    tiers: [
      { name: "flex", contextWindow: 400_000, inputPrice: 0.875, outputPrice: 7, cacheReadsPrice: 0.0875 },
      { name: "priority", contextWindow: 400_000, inputPrice: 3.5, outputPrice: 28, cacheReadsPrice: 0.35 },
    ],
  },
  {
    name: "gpt-5.3", series: "GPT", description: "GPT-5.3 for Cyou Code Router",
    inputPrice: 1.75, outputPrice: 14, cacheReadPrice: 0.175,
    contextWindow: 400_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high", "xhigh"], reasoningEffort: "medium",
    promptCacheRetention: "24h",
    tiers: [
      { name: "flex", contextWindow: 400_000, inputPrice: 0.875, outputPrice: 7, cacheReadsPrice: 0.0875 },
      { name: "priority", contextWindow: 400_000, inputPrice: 3.5, outputPrice: 28, cacheReadsPrice: 0.35 },
    ],
  },
  {
    name: "claude-sonnet-4-6", series: "Claude", description: "Claude Sonnet 4.6 via Cyou Code Router",
    inputPrice: 3, outputPrice: 15, cacheWritePrice: 3.75, cacheReadPrice: 0.3,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high"], reasoningEffort: "medium",
    tiers: [{ contextWindow: 1_050_000, inputPrice: 6, outputPrice: 22.5, cacheWritesPrice: 7.5, cacheReadsPrice: 0.6 }],
  },
  {
    name: "claude-sonnet-5", series: "Claude", description: "Claude Sonnet 5 via Cyou Code Router",
    inputPrice: 2, outputPrice: 10, cacheWritePrice: 2.5, cacheReadPrice: 0.2,
    contextWindow: 300_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["low", "medium", "high", "xhigh", "max"], reasoningEffort: "high",
  },
  {
    name: "claude-opus-4-7", series: "Claude", description: "Claude Opus 4.7 via Cyou Code Router",
    inputPrice: 5, outputPrice: 25, cacheWritePrice: 6.25, cacheReadPrice: 0.5,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high", "xhigh"], reasoningEffort: "medium",
    tiers: [{ contextWindow: 1_050_000, inputPrice: 10, outputPrice: 37.5, cacheWritesPrice: 12.5, cacheReadsPrice: 1 }],
  },
  {
    name: "claude-opus-4-8", series: "Claude", description: "Claude Opus 4.8 via Cyou Code Router",
    inputPrice: 5, outputPrice: 25, cacheWritePrice: 6.25, cacheReadPrice: 0.5,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high", "xhigh"], reasoningEffort: "medium",
    tiers: [{ contextWindow: 1_050_000, inputPrice: 10, outputPrice: 37.5, cacheWritesPrice: 12.5, cacheReadsPrice: 1 }],
  },
  {
    name: "claude-opus-5", series: "Claude", description: "Claude Opus 5 via Cyou Code Router",
    inputPrice: 5, outputPrice: 25, cacheWritePrice: 6.25, cacheReadPrice: 0.5,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high", "xhigh"], reasoningEffort: "medium",
    tiers: [{ contextWindow: 1_050_000, inputPrice: 10, outputPrice: 37.5, cacheWritesPrice: 12.5, cacheReadsPrice: 1 }],
  },
  {
    name: "claude-fable-5", series: "Claude", description: "Claude Fable 5 via Cyou Code Router",
    inputPrice: 10, outputPrice: 50, cacheWritePrice: 12.5, cacheReadPrice: 1,
    contextWindow: 272_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "low", "medium", "high", "xhigh"], reasoningEffort: "medium",
    tiers: [{ contextWindow: 1_050_000, inputPrice: 20, outputPrice: 75, cacheWritesPrice: 25, cacheReadsPrice: 2 }],
  },
  {
    name: "deepseek-v4-pro", series: "DeepSeek", description: "DeepSeek-V4-Pro via Cyou Code Router",
    inputPrice: 0.435, outputPrice: 0.87, cacheWritePrice: 0.435, cacheReadPrice: 0.003625,
    contextWindow: 1_000_000, maxOutputTokens: 384_000,
    supportsImages: false, supportsCache: true,
    supportsReasoningEffort: ["none", "high", "max"], reasoningEffort: "max",
  },
  {
    name: "deepseek-v4-flash", series: "DeepSeek", description: "DeepSeek-V4-Flash via Cyou Code Router",
    inputPrice: 0.14, outputPrice: 0.28, cacheWritePrice: 0.14, cacheReadPrice: 0.03,
    contextWindow: 1_000_000, maxOutputTokens: 384_000,
    supportsImages: false, supportsCache: true,
    supportsReasoningEffort: ["none", "high", "max"], reasoningEffort: "max",
  },
  {
    name: "deepseek-v4.1-flash", series: "DeepSeek", description: "DeepSeek-V4.1-Flash via Cyou Code Router",
    inputPrice: 0.14, outputPrice: 0.28, cacheWritePrice: 0.14, cacheReadPrice: 0.03,
    contextWindow: 1_000_000, maxOutputTokens: 384_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "high", "max"], reasoningEffort: "max",
  },
  {
    name: "glm-5.1", series: "GLM", description: "GLM-5.1 Long via 腾讯云",
    inputPrice: 1.11, outputPrice: 3.9, cacheWritePrice: 1.11, cacheReadPrice: 0.22,
    contextWindow: 200_000, maxOutputTokens: 128_000,
    supportsImages: false, supportsCache: true,
    supportsReasoningEffort: ["none", "high"], reasoningEffort: "high",
  },
  {
    name: "glm-5.2", series: "GLM", description: "GLM-5.2 Long via 腾讯云",
    inputPrice: 1.11, outputPrice: 3.9, cacheWritePrice: 1.11, cacheReadPrice: 0.22,
    contextWindow: 300_000, maxOutputTokens: 128_000,
    supportsImages: false, supportsCache: true,
    supportsReasoningEffort: ["none", "high", "xhigh"], reasoningEffort: "high",
  },
  {
    name: "glm-5.3-flash", series: "GLM", description: "GLM-5.3-Flash Long via 腾讯云",
    inputPrice: 1.11, outputPrice: 3.9, cacheWritePrice: 1.11, cacheReadPrice: 0.22,
    contextWindow: 1_000_000, maxOutputTokens: 128_000,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["high", "xhigh"], reasoningEffort: "high",
  },
  {
    name: "kimi-k2.6", series: "Kimi", description: "Kimi-K2.6 via Aliyun Bailian",
    inputPrice: 0.9, outputPrice: 3.76, cacheWritePrice: 0.9, cacheReadPrice: 0.18,
    contextWindow: 256_000, maxOutputTokens: 16_384,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["none", "high"], reasoningEffort: "high",
  },
  {
    name: "kimi-k3", series: "Kimi", description: "Kimi-K3 via Cyou Code Router",
    inputPrice: 2.857, outputPrice: 14.286, cacheWritePrice: 2.857, cacheReadPrice: 0.286,
    contextWindow: 300_000, maxOutputTokens: 16_384,
    supportsImages: true, supportsCache: true,
    supportsReasoningEffort: ["low", "high", "max"], reasoningEffort: "high",
  },
]