import { describe, expect, it, vi } from "vitest"
import type { AICompletion, AICompletionProvider, AIServiceResult } from "../ai-service"
import { describeOutcome, generateAnalysis, parseMaxTokens, toClientDiagnostics } from "../ai-service"

const VALID_ITEMS = JSON.stringify({
  items: [
    {
      title: "各区域销售额",
      insight: "华东最高",
      querySpec: { table: "orders", measures: [{ field: "amount", aggregation: "sum", alias: "total" }] },
      displayConfig: { chartType: "kpi", mapping: { value: "total" } },
      context: [],
      statTest: null,
    },
  ],
})

const TRUNCATED = '{\n  "items": [\n    {\n      "title": "月度趋势",\n      "insight": "按年月聚合",\n      "querySpec": {\n        "table": "fact_orders",\n        "measures": [\n          { "field": "pay_amount", "aggregatio'

const VALID_ITEM = { title: "t", insight: "i", chart: { chartType: "table" as const }, fallback: false }

function providerReturning(...completions: AICompletion[]): AICompletionProvider {
  let index = 0
  return {
    async complete() {
      const completion = completions[Math.min(index, completions.length - 1)]
      if (completion === undefined) throw new Error("预置 completion 为空")
      index += 1
      return completion
    },
  }
}

describe("parseMaxTokens", () => {
  it("默认 8000；显式值生效并夹在 1000..32000", () => {
    expect(parseMaxTokens(undefined)).toBe(8000)
    expect(parseMaxTokens("16000")).toBe(16000)
    expect(parseMaxTokens("10")).toBe(8000)
    expect(parseMaxTokens("999999")).toBe(32_000)
    expect(parseMaxTokens("abc")).toBe(8000)
  })
})

describe("describeOutcome", () => {
  it("有可用条目即 ok，且不产生用户提示", () => {
    const outcome = describeOutcome({ content: VALID_ITEMS, finishReason: "stop", items: [VALID_ITEM] })

    expect(outcome.reason).toBe("ok")
    expect(outcome.message).toBe("")
    expect(outcome.rawPreview).toBeUndefined()
  })

  it("空内容 / 截断 / 非法 JSON / 无有效项 各有分类与可执行提示", () => {
    const empty = describeOutcome({ content: "  ", finishReason: "stop", items: [] })
    expect(empty.reason).toBe("empty")

    const truncated = describeOutcome({ content: TRUNCATED, finishReason: "length", items: [] })
    expect(truncated.reason).toBe("truncated")
    expect(truncated.message).toContain("拆小")

    const invalid = describeOutcome({ content: "这是解释性文字，不是 JSON", finishReason: "stop", items: [] })
    expect(invalid.reason).toBe("invalid_json")

    const noItem = describeOutcome({ content: '{"items":[]}', finishReason: "stop", items: [] })
    expect(noItem.reason).toBe("no_valid_item")

    for (const outcome of [empty, truncated, invalid, noItem]) {
      expect(outcome.message.length).toBeGreaterThan(0)
      expect(outcome.rawPreview).toBeDefined()
    }
  })
})

describe("toClientDiagnostics", () => {
  it("只回传分类与一句话，不带原始响应", () => {
    const result: AIServiceResult = {
      items: [],
      reason: "truncated",
      message: "AI 输出被截断（达到输出上限），把问题拆小一点再问一次",
      attempts: 2,
      rawPreview: TRUNCATED,
    }

    const diagnostics = toClientDiagnostics(result)

    expect(diagnostics).toEqual({ reason: "truncated", message: result.message, attempts: 2 })
    expect(JSON.stringify(diagnostics)).not.toContain("querySpec")
  })
})

describe("generateAnalysis 有界修复", () => {
  it("首次截断时追加纠正指令重问一次，拿到结果即返回（attempts=2）", async () => {
    const provider = providerReturning(
      { content: TRUNCATED, finishReason: "length" },
      { content: VALID_ITEMS, finishReason: "stop" },
    )
    const complete = vi.spyOn(provider, "complete")

    const result = await generateAnalysis("按区域统计", "TABLE orders(amount numeric)", [], provider)

    expect(result.items).toHaveLength(1)
    expect(result.attempts).toBe(2)
    expect(result.reason).toBe("ok")
    expect(complete.mock.calls[1]?.[0].messages.at(-1)?.content).toContain("只输出 1 条 items")
  })

  it("连续两次不可用时返回后端一句话（不做第三次尝试）", async () => {
    const provider = providerReturning(
      { content: TRUNCATED, finishReason: "length" },
      { content: TRUNCATED, finishReason: "length" },
    )
    const complete = vi.spyOn(provider, "complete")

    const result = await generateAnalysis("按区域统计", "TABLE orders(amount numeric)", [], provider)

    expect(complete).toHaveBeenCalledTimes(2)
    expect(result.items).toEqual([])
    expect(result.reason).toBe("truncated")
    expect(result.attempts).toBe(2)
    expect(result.message).toContain("截断")
  })
})
