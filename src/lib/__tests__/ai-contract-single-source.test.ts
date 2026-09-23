import { describe, expect, it } from "vitest"
import { AI_RESPONSE_JSON_SCHEMA, MAX_INSIGHT_ITEMS, buildSystemPrompt, parseInsightItems } from "../ai-contract"

type Variant = { required: string[]; properties: Record<string, unknown> }

/** 下标访问在 noUncheckedIndexedAccess 下带 undefined；越界就是断言前提破了，抛错比让 expect 拿到 undefined 更早暴露 */
function indexed<T>(items: readonly T[], at: number): T {
  const item = items[at]
  if (item === undefined) throw new Error(`期望第 ${at} 项存在，实际越界`)
  return item
}

function variants(): Variant[] {
  return AI_RESPONSE_JSON_SCHEMA.schema.properties.items.items.anyOf as unknown as Variant[]
}

/** 声明进 schema 的截断上限（变体 0 = 优先 querySpec，变体 1 = 回退 sql）；
 *  INSIGHT_FIELDS 本身不导出，故从导出的 schema 反读——单一来源是否成立只能这样验 */
function declaredMaxLength(variantIndex: number, field: "title" | "insight"): number {
  return (indexed(variants(), variantIndex).properties[field] as { maxLength: number }).maxLength
}

const prompt = buildSystemPrompt("TABLE sales(region text, amount numeric)")

describe("洞察项契约单一来源", () => {
  it("提示词、schema、解析上限来自同一份声明", () => {
    expect(prompt).toContain(`最多 ${MAX_INSIGHT_ITEMS} 项`)
    expect(AI_RESPONSE_JSON_SCHEMA.schema.properties.items.maxItems).toBe(MAX_INSIGHT_ITEMS)
  })

  it("每个 schema 变体的字段都在提示词里出现", () => {
    for (const variant of variants()) {
      for (const field of variant.required) {
        expect(Object.keys(variant.properties)).toContain(field)
        expect(prompt).toContain(`"${field}"`)
      }
    }
  })

  it("提示词要求只返回 JSON：网关 json_object 模式的前置条件", () => {
    expect(prompt.toLowerCase()).toContain("json")
    expect(prompt).toContain("只返回符合 JSON Schema 的对象")
    expect(prompt).toContain("不输出 Markdown")
  })

  it("提示词里的形状示例替换占位符后是合法 JSON", () => {
    for (const prefix of ["- 根对象形状（优先变体）：", "- 根对象形状（回退变体，仅当无法给出 querySpec 时使用）："]) {
      const line = prompt.split("\n").find((candidate) => candidate.startsWith(prefix))
      expect(line).toBeDefined()
      const json = (line as string)
        .slice(prefix.length)
        .replace(/\{\.\.\.\}/g, "{}")
        .replace(/"SELECT \.\.\."/g, '""')
      expect(() => JSON.parse(json)).not.toThrow()
    }
  })

  it("优先变体不声明 sql，回退变体才声明（消除提示词与 schema 的矛盾）", () => {
    const preferred = indexed(variants(), 0)
    const fallback = indexed(variants(), 1)

    expect(preferred.required).toContain("querySpec")
    expect(preferred.required).not.toContain("sql")
    expect(fallback.required).toContain("sql")
    expect(fallback.required).not.toContain("querySpec")
  })

  it("解析按声明截断标题与结论长度", () => {
    const content = JSON.stringify({
      items: [{
        title: "标".repeat(120),
        insight: "结".repeat(1200),
        querySpec: { table: "sales", measures: [{ field: "amount", aggregation: "sum", alias: "total" }] },
        displayConfig: { chartType: "kpi", mapping: { value: "total" } },
        context: [],
        statTest: null,
      }],
    })

    const item = indexed(parseInsightItems(content), 0)

    expect(item.title.length).toBe(declaredMaxLength(0, "title"))
    expect(item.insight.length).toBe(declaredMaxLength(0, "insight"))
  })

  it("两条解析分支的截断长度都必须跟随同一份 schema 声明", () => {
    const long = { title: "标".repeat(120), insight: "结".repeat(1200) }
    const preferred = indexed(parseInsightItems(JSON.stringify({
      items: [{
        ...long,
        querySpec: { table: "sales", measures: [{ field: "amount", aggregation: "sum", alias: "total" }] },
        displayConfig: { chartType: "kpi", mapping: { value: "total" } },
        context: [],
        statTest: null,
      }],
    })), 0)
    const fallback = indexed(parseInsightItems(JSON.stringify({
      items: [{
        ...long,
        sql: "SELECT region AS region, SUM(amount) AS total FROM sales GROUP BY region",
        chart: { type: "bar", mapping: { x: "region", y: "total" } },
      }],
    })), 0)

    // 上一例只走优先变体；回退变体是另一条独立语句，不跟声明就会单侧漂移
    expect(fallback.title.length).toBe(declaredMaxLength(1, "title"))
    expect(fallback.insight.length).toBe(declaredMaxLength(1, "insight"))
    expect(fallback.title.length).toBe(preferred.title.length)
    expect(fallback.insight.length).toBe(preferred.insight.length)
  })
})
