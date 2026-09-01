import { describe, expect, it } from "vitest"
import { AI_RESPONSE_JSON_SCHEMA, buildSystemPrompt, parseInsightItems } from "../ai-contract"
import { generateAnalysis, type AICompletionProvider } from "../ai-service"

// 旧格式（回退路径）：仅 sql + chart
const legacy = JSON.stringify({
  items: [{
    title: "区域销售",
    insight: "比较各区域销售额",
    sql: "SELECT region AS region, SUM(amount) AS total FROM sales GROUP BY region",
    chart: { type: "bar", mapping: { x: "region", y: "total" } },
  }],
})

// 新格式（优先路径）：querySpec + displayConfig（附带 sql 供旧客户端）
const newFormat = JSON.stringify({
  items: [{
    title: "区域销售",
    insight: "比较各区域销售额",
    querySpec: {
      table: "sales",
      dimensions: ["region"],
      measures: [{ field: "amount", aggregation: "sum", alias: "total" }],
      sort: [{ field: "total", direction: "desc" }],
      limit: 100,
    },
    displayConfig: { chartType: "bar", mapping: { x: "region", y: "total" } },
    sql: "SELECT region AS region, SUM(amount) AS total FROM sales GROUP BY region",
  }],
})

describe("AI prompt and output contract", () => {
  it("builds a domain-neutral prompt from only the current schema", () => {
    const prompt = buildSystemPrompt("TABLE sales(region text, amount numeric)")
    expect(prompt).toContain("TABLE sales(region text, amount numeric)")
    expect(prompt).toContain("聚合和数据整形必须在 SQL 中完成")
    expect(prompt).toContain("首次结果保持表格")
    expect(prompt).toContain("querySpec")
    expect(prompt).not.toMatch(/药店|药房|门店|pharmacy/i)
  })

  it("injects data profile text when provided", () => {
    const prompt = buildSystemPrompt("TABLE sales(region text, amount numeric)", "## 数据轮廓\n| 列 | 类型 | 唯一值 |")
    expect(prompt).toContain("数据轮廓")
    expect(prompt).toContain("| 列 | 类型 | 唯一值 |")
    const plain = buildSystemPrompt("TABLE sales(region text, amount numeric)")
    expect(plain).not.toContain("数据轮廓")
  })

  it("exposes a strict provider structured-output schema with querySpec and displayConfig", () => {
    expect(AI_RESPONSE_JSON_SCHEMA).toMatchObject({
      name: "analytics_insights",
      strict: true,
      schema: { type: "object", additionalProperties: false },
    })
    // item 为双变体：新格式（querySpec+displayConfig）与旧格式回退（sql+chart）
    const variants = AI_RESPONSE_JSON_SCHEMA.schema.properties.items.items.anyOf
    expect(variants[0].properties.querySpec).toBeDefined()
    expect(variants[0].properties.displayConfig).toBeDefined()
    expect(variants[1].properties.sql).toBeDefined()
    expect(variants[1].properties.chart).toBeDefined()
    expectStrictObjectRequirements(AI_RESPONSE_JSON_SCHEMA.schema)
  })

  it("parses the new querySpec + displayConfig format (fallback=false)", () => {
    const [item] = parseInsightItems(newFormat)
    expect(item).toMatchObject({
      title: "区域销售",
      insight: "比较各区域销售额",
      fallback: false,
      querySpec: {
        table: "sales",
        dimensions: ["region"],
        measures: [{ field: "amount", aggregation: "sum", alias: "total" }],
        sort: [{ field: "total", direction: "desc" }],
        limit: 100,
      },
      displayConfig: { chartType: "bar", mapping: { chartType: "bar", x: "region", y: "total", mode: "grouped" } },
      chart: { chartType: "bar", x: "region", y: "total", mode: "grouped" },
      sql: "SELECT region AS region, SUM(amount) AS total FROM sales GROUP BY region",
    })
  })

  it("parses the legacy sql + chart format into a fallback item", () => {
    expect(parseInsightItems(legacy)).toEqual([{
      title: "区域销售",
      insight: "比较各区域销售额",
      sql: "SELECT region AS region, SUM(amount) AS total FROM sales GROUP BY region",
      chart: { chartType: "bar", x: "region", y: "total", mode: "grouped" },
      displayConfig: undefined,
      fallback: true,
    }])
  })

  it.each([
    ["unknown chart", { type: "radar", mapping: {} }],
    ["missing mapping", { type: "bar", mapping: { x: "region" } }],
    ["unknown output column", { type: "bar", mapping: { x: "region", y: "missing" } }],
  ])("rejects legacy %s", (_label, chart) => {
    const parsed = JSON.parse(legacy)
    parsed.items[0].chart = chart
    expect(parseInsightItems(JSON.stringify(parsed))).toEqual([])
  })

  it("rejects unsafe SQL and malformed JSON without a text fallback", () => {
    const parsed = JSON.parse(legacy)
    parsed.items[0].sql = "DELETE FROM sales"
    expect(parseInsightItems(JSON.stringify(parsed))).toEqual([])
    expect(parseInsightItems("```sql\nSELECT * FROM sales\n```")).toEqual([])
    expect(parseInsightItems("not json")).toEqual([])
  })

  it("falls back to sql when querySpec is structurally invalid", () => {
    const parsed = JSON.parse(newFormat)
    parsed.items[0].querySpec = { dimensions: ["region"] } // 缺 table
    const [item] = parseInsightItems(JSON.stringify(parsed))
    expect(item.fallback).toBe(true)
    expect(item.sql).toBe("SELECT region AS region, SUM(amount) AS total FROM sales GROUP BY region")
  })

  it("uses an injected provider and requests native structured output", async () => {
    let request: Parameters<AICompletionProvider["complete"]>[0] | undefined
    const provider: AICompletionProvider = {
      async complete(input) {
        request = input
        return newFormat
      },
    }

    const result = await generateAnalysis("比较区域", "TABLE sales(region text, amount numeric)", [], provider)

    expect(result.items).toHaveLength(1)
    expect(result.items[0].fallback).toBe(false)
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
