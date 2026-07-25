import { describe, expect, it } from "vitest"
import { AI_RESPONSE_JSON_SCHEMA, buildSystemPrompt, parseInsightItems } from "../ai-contract"
import { generateSQL, type AICompletionProvider } from "../ai-service"

const valid = JSON.stringify({
  items: [{
    title: "区域销售",
    insight: "比较各区域销售额",
    sql: "SELECT region AS region, SUM(amount) AS total FROM sales GROUP BY region",
    chart: { type: "bar", mapping: { x: "region", y: "total" } },
  }],
})

describe("AI prompt and output contract", () => {
  it("builds a domain-neutral prompt from only the current schema", () => {
    const prompt = buildSystemPrompt("TABLE sales(region text, amount numeric)")
    expect(prompt).toContain("TABLE sales(region text, amount numeric)")
    expect(prompt).toContain("聚合和数据整形必须在 SQL 中完成")
    expect(prompt).toContain("首次结果保持表格")
    expect(prompt).not.toMatch(/药店|药房|门店|pharmacy/i)
  })

  it("exposes a strict provider structured-output schema", () => {
    expect(AI_RESPONSE_JSON_SCHEMA).toMatchObject({
      name: "analytics_insights",
      strict: true,
      schema: { type: "object", additionalProperties: false },
    })
    expectStrictObjectRequirements(AI_RESPONSE_JSON_SCHEMA.schema)
  })

  it("parses valid output into a discriminated chart mapping", () => {
    expect(parseInsightItems(valid)).toEqual([{
      title: "区域销售",
      insight: "比较各区域销售额",
      sql: "SELECT region AS region, SUM(amount) AS total FROM sales GROUP BY region",
      chart: { chartType: "bar", x: "region", y: "total", mode: "grouped" },
    }])
  })

  it.each([
    ["unknown chart", { type: "radar", mapping: {} }],
    ["missing mapping", { type: "bar", mapping: { x: "region" } }],
    ["unknown output column", { type: "bar", mapping: { x: "region", y: "missing" } }],
  ])("rejects %s", (_label, chart) => {
    const parsed = JSON.parse(valid)
    parsed.items[0].chart = chart
    expect(parseInsightItems(JSON.stringify(parsed))).toEqual([])
  })

  it("rejects unsafe SQL and malformed JSON without a text fallback", () => {
    const parsed = JSON.parse(valid)
    parsed.items[0].sql = "DELETE FROM sales"
    expect(parseInsightItems(JSON.stringify(parsed))).toEqual([])
    expect(parseInsightItems("```sql\nSELECT * FROM sales\n```")).toEqual([])
    expect(parseInsightItems("not json")).toEqual([])
  })

  it("uses an injected provider and requests native structured output", async () => {
    let request: Parameters<AICompletionProvider["complete"]>[0] | undefined
    const provider: AICompletionProvider = {
      async complete(input) {
        request = input
        return valid
      },
    }

    const result = await generateSQL("比较区域", "TABLE sales(region text, amount numeric)", [], provider)

    expect(result.items).toHaveLength(1)
    expect(request?.responseSchema).toBe(AI_RESPONSE_JSON_SCHEMA)
    expect(request?.messages.at(-1)).toEqual({ role: "user", content: "比较区域" })
  })
})

function expectStrictObjectRequirements(value: unknown): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach(expectStrictObjectRequirements)
    return
  }
  const node = value as Record<string, unknown>
  if (node.type === "object" && node.properties && typeof node.properties === "object") {
    const keys = Object.keys(node.properties)
    expect(node.required).toEqual(keys)
  }
  Object.values(node).forEach(expectStrictObjectRequirements)
}
