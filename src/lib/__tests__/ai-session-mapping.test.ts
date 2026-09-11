import { describe, expect, it } from "vitest"
import type { InsightItem } from "@/lib/ai-contract"
import { buildInitFromAi, describeAskFailure, fallbackSqlOf } from "@/lib/ai-session-mapping"

function item(overrides: Partial<InsightItem> = {}): InsightItem {
  return {
    title: "各区域销售额",
    insight: "华东最高",
    chart: { chartType: "bar", x: "region", y: "total" },
    fallback: false,
    ...overrides,
  }
}

describe("buildInitFromAi", () => {
  it("querySpec + displayConfig 路径原样交给编译管线", () => {
    const payload = buildInitFromAi(
      item({
        querySpec: { table: "orders" },
        displayConfig: { chartType: "bar", mapping: { chartType: "bar", x: "region", y: "total" } },
      }),
      "按区域统计",
    )

    expect(payload).toEqual({
      question: "按区域统计",
      title: "各区域销售额",
      insight: "华东最高",
      querySpec: { table: "orders" },
      displayConfig: { chartType: "bar", mapping: { chartType: "bar", x: "region", y: "total" } },
    })
  })

  it("缺 querySpec/displayConfig 时留空占位并用 chart 兜底", () => {
    const payload = buildInitFromAi(item({ sql: "SELECT 1" }), "按区域统计")

    expect(payload.querySpec).toEqual({ table: "" })
    expect(payload.displayConfig).toEqual({ chartType: "bar", mapping: { chartType: "bar", x: "region", y: "total" } })
  })
})

describe("fallbackSqlOf", () => {
  it("有 querySpec 且非回退项时不走 SQL 直通", () => {
    expect(fallbackSqlOf(item({ querySpec: { table: "orders" }, sql: "SELECT 1" }))).toBeNull()
  })

  it("回退项仅在 SQL 通过只读预检时返回编译结果", () => {
    expect(fallbackSqlOf(item({ fallback: true, sql: "SELECT 1 AS total", sqlValid: true }))).toEqual({
      sql: "SELECT 1 AS total",
      params: [],
    })
    // 未通过只读预检的 SQL 只能复制，不能一键执行
    expect(fallbackSqlOf(item({ fallback: true, sql: "DELETE FROM orders", sqlValid: false }))).toBeNull()
    expect(fallbackSqlOf(item({ fallback: true }))).toBeNull()
  })
})

describe("describeAskFailure", () => {
  it("识别未配置错误与普通错误", () => {
    const notConfigured = Object.assign(new Error("缺少 API Key"), { code: "AI_NOT_CONFIGURED" })

    expect(describeAskFailure(notConfigured)).toEqual({ message: "缺少 API Key", notConfigured: true })
    expect(describeAskFailure(new Error("AI 分析失败：HTTP 500"))).toEqual({ message: "AI 分析失败：HTTP 500", notConfigured: false })
    expect(describeAskFailure("boom")).toEqual({ message: "请求失败", notConfigured: false })
  })
})
