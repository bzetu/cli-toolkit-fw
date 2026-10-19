import { describe, expect, test } from "bun:test"
import {
  FALLBACK_MODELS,
  formatContext,
  formatModelsTable,
  formatPrice,
  inferSeries,
  mapToModelInfo,
  modelMultiplier,
  type ModelInfo,
  type ModelSeries,
} from "../models"

const expectedSeries: ModelSeries[] = ["GPT", "Claude", "DeepSeek", "GLM", "Kimi"]

// ── inferSeries ──
describe("inferSeries", () => {
  test("infers GPT from gpt-* names", () => {
    expect(inferSeries("gpt-5.3-codex")).toBe("GPT")
    expect(inferSeries("gpt-6-astra")).toBe("GPT")
    expect(inferSeries("gpt-5.4-mini")).toBe("GPT")
  })

  test("infers Claude from claude-* names", () => {
    expect(inferSeries("claude-sonnet-5")).toBe("Claude")
    expect(inferSeries("claude-opus-5")).toBe("Claude")
  })

  test("infers DeepSeek, GLM, Kimi", () => {
    expect(inferSeries("deepseek-v4-pro")).toBe("DeepSeek")
    expect(inferSeries("glm-5.2")).toBe("GLM")
    expect(inferSeries("kimi-k3")).toBe("Kimi")
  })
})

// ── mapToModelInfo ──
describe("mapToModelInfo", () => {
  test("maps all fields correctly from raw plugin shape", () => {
    const raw = {
      maxTokens: 128000,
      contextWindow: 272000,
      supportsImages: true,
      supportsPromptCache: true,
      promptCacheTtl: "30m",
      supportsReasoningEffort: ["low", "medium", "high"],
      reasoningEffort: "medium",
      inputPrice: 5,
      outputPrice: 30,
      cacheReadsPrice: 0.5,
      description: "Test Model",
      tiers: [
        { name: "flex", contextWindow: 1000000, inputPrice: 2.5, outputPrice: 15, cacheReadsPrice: 0.25 },
      ],
    }
    const info = mapToModelInfo("gpt-test", raw)
    expect(info.name).toBe("gpt-test")
    expect(info.series).toBe("GPT")
    expect(info.maxOutputTokens).toBe(128000)
    expect(info.contextWindow).toBe(272000)
    expect(info.supportsImages).toBe(true)
    expect(info.supportsCache).toBe(true)
    expect(info.cacheReadPrice).toBe(0.5)
    expect(info.cacheWritePrice).toBeUndefined()
    expect(info.promptCacheTtl).toBe("30m")
    expect(info.tiers).toHaveLength(1)
    expect(info.tiers![0].name).toBe("flex")
  })

  test("maps Claude-style model with cache write price", () => {
    const raw = {
      contextWindow: 272000,
      supportsImages: true,
      supportsPromptCache: true,
      inputPrice: 5,
      outputPrice: 25,
      cacheWritesPrice: 6.25,
      cacheReadsPrice: 0.5,
      description: "Claude Test",
    }
    const info = mapToModelInfo("claude-test", raw)
    expect(info.series).toBe("Claude")
    expect(info.cacheWritePrice).toBe(6.25)
    expect(info.cacheReadPrice).toBe(0.5)
  })

  test("maps model without maxTokens (undefined maxOutputTokens)", () => {
    const raw = {
      contextWindow: 400000,
      supportsImages: false,
      supportsPromptCache: false,
      inputPrice: 1.75,
      outputPrice: 14,
      description: "Minimal Model",
    }
    const info = mapToModelInfo("gpt-minimal", raw)
    expect(info.maxOutputTokens).toBeUndefined()
  })
})

// ── formatPrice ──
describe("formatPrice", () => {
  test("prices with <= 2 decimals get exactly 2 decimal places", () => {
    expect(formatPrice(14)).toBe("14.00")
    expect(formatPrice(5)).toBe("5.00")
    expect(formatPrice(1.75)).toBe("1.75")
    expect(formatPrice(0.5)).toBe("0.50")
    expect(formatPrice(6.25)).toBe("6.25")
  })

  test("prices with > 2 decimals keep natural precision", () => {
    expect(formatPrice(0.175)).toBe("0.175")
    expect(formatPrice(2.857)).toBe("2.857")
    expect(formatPrice(0.003625)).toBe("0.003625")
  })

  test("undefined renders as em-dash", () => {
    expect(formatPrice(undefined)).toBe("\u2014")
  })
})

// ── formatContext ──
describe("formatContext", () => {
  test("thousands render as k", () => {
    expect(formatContext(272_000)).toBe("272k")
    expect(formatContext(400_000)).toBe("400k")
    expect(formatContext(256_000)).toBe("256k")
  })

  test("millions render as M", () => {
    expect(formatContext(1_000_000)).toBe("1M")
    expect(formatContext(1_050_000)).toBe("1.1M")
  })
})

// ── modelMultiplier ──
describe("modelMultiplier", () => {
  test("returns the inputMultiplier when set", () => {
    const model: ModelInfo = {
      name: "test", series: "GPT", description: "", inputPrice: 1, outputPrice: 2,
      contextWindow: 1000, supportsImages: false, supportsCache: false,
      inputMultiplier: "14.71x",
    }
    expect(modelMultiplier(model)).toBe("14.71x")
  })

  test("returns em-dash when inputMultiplier is unset", () => {
    const model: ModelInfo = {
      name: "test", series: "GPT", description: "", inputPrice: 1, outputPrice: 2,
      contextWindow: 1000, supportsImages: false, supportsCache: false,
    }
    expect(modelMultiplier(model)).toBe("\u2014")
  })
})

// ── formatModelsTable ──
describe("formatModelsTable", () => {
  test("renders a table with all models and expected headers", () => {
    const table = formatModelsTable(FALLBACK_MODELS)
    expect(table).toContain("\u6a21\u578b")
    expect(table).toContain("\u7cfb\u5217")
    expect(table).toContain("\u8f93\u5165")
    expect(table).toContain("\u8f93\u51fa")
    expect(table).toContain("\u7f13\u5b58\u5199")
    expect(table).toContain("\u7f13\u5b58\u8bfb")
    expect(table).toContain("\u4e0a\u4e0b\u6587")
    expect(table).toContain("\u6700\u5927\u8f93\u51fa")
    expect(table).toContain("\u56fe\u50cf")
    expect(table).toContain("\u7f13\u5b58")
    expect(table).toContain("\u500d\u7387")
    expect(table).toContain("\u5907\u6ce8")
    for (const model of FALLBACK_MODELS) {
      expect(table).toContain(model.name)
    }
  })
})

// ── FALLBACK_MODELS structural integrity ──
describe("FALLBACK_MODELS", () => {
  test("is non-empty and every entry is well-formed", () => {
    expect(FALLBACK_MODELS.length).toBeGreaterThan(0)
    for (const model of FALLBACK_MODELS) {
      expect(expectedSeries).toContain(model.series)
      expect(model.inputPrice).toBeGreaterThan(0)
      expect(model.outputPrice).toBeGreaterThan(0)
      expect(model.contextWindow).toBeGreaterThan(0)
    }
  })

  test("model names are unique", () => {
    const names = FALLBACK_MODELS.map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
  })
})