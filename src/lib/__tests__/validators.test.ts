import { describe, expect, it } from "vitest"
import { validateDisplayConfig } from "../validators"
import type { DisplayConfig } from "@/types/session"
import type { SchemaData } from "@/types"

const schema: SchemaData = {
  version: 1,
  tables: [
    {
      name: "orders",
      columns: [
        { name: "id", type: "integer", nullable: false, isPrimary: true },
        { name: "customer_name", type: "text", nullable: true, isPrimary: false },
        { name: "amount", type: "numeric", nullable: true, isPrimary: false },
        { name: "created_at", type: "timestamp", nullable: true, isPrimary: false },
        { name: "is_vip", type: "boolean", nullable: true, isPrimary: false },
      ],
      rowEstimate: 1000,
    },
  ],
  relations: [],
}

const dataset = {
  columns: [
    { name: "customer_name", type: "text", semanticType: "categorical" as const },
    { name: "amount", type: "numeric", semanticType: "numeric" as const },
    { name: "category", type: "text", semanticType: "categorical" as const },
  ],
  rows: [
    { customer_name: "A", amount: 10, category: "x" },
    { customer_name: "A", amount: 20, category: "y" },
    { customer_name: "B", amount: NaN, category: "x" },
  ],
}

describe("validateDisplayConfig（schema 模式）", () => {
  it("合法配置通过", () => {
    const config: DisplayConfig = {
      chartType: "bar",
      mapping: { chartType: "bar", x: "customer_name", y: "amount", mode: "grouped" },
    }
    const result = validateDisplayConfig(config, { mode: "schema", schema })
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it("缺少必填槽位时报 MISSING_MAPPING", () => {
    const config: DisplayConfig = {
      chartType: "bar",
      mapping: { chartType: "bar", x: "customer_name" },
    }
    const result = validateDisplayConfig(config, { mode: "schema", schema })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === "MISSING_MAPPING")).toBe(true)
  })

  it("字段不存在时报 COLUMN_NOT_FOUND", () => {
    const config: DisplayConfig = {
      chartType: "bar",
      mapping: { chartType: "bar", x: "ghost", y: "amount" },
    }
    const result = validateDisplayConfig(config, { mode: "schema", schema })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === "COLUMN_NOT_FOUND")).toBe(true)
  })

  it("类型不匹配时报 INCOMPATIBLE_TYPE（文本列放数值轴）", () => {
    const config: DisplayConfig = {
      chartType: "bar",
      mapping: { chartType: "bar", x: "customer_name", y: "customer_name" },
    }
    const result = validateDisplayConfig(config, { mode: "schema", schema })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === "INCOMPATIBLE_TYPE")).toBe(true)
  })

  it("boolean 列可作为分类轴（新增支持）", () => {
    const config: DisplayConfig = {
      chartType: "bar",
      mapping: { chartType: "bar", x: "is_vip", y: "amount" },
    }
    const result = validateDisplayConfig(config, { mode: "schema", schema })
    expect(result.valid).toBe(true)
  })
})

describe("validateDisplayConfig（data 模式）", () => {
  it("无效数值产生 INVALID_NUMERIC 警告", () => {
    const config: DisplayConfig = {
      chartType: "scatter",
      mapping: { chartType: "scatter", x: "amount", y: "amount" },
    }
    const result = validateDisplayConfig(config, { mode: "data", dataset })
    expect(result.valid).toBe(true)
    expect(result.issues.some((i) => i.code === "INVALID_NUMERIC" && i.severity === "warning")).toBe(true)
  })

  it("重复坐标产生 DUPLICATE_COORDINATE 错误（line 和 bar）", () => {
    const line: DisplayConfig = {
      chartType: "line",
      mapping: { chartType: "line", x: "customer_name", y: "amount" },
    }
    const bar: DisplayConfig = {
      chartType: "bar",
      mapping: { chartType: "bar", x: "customer_name", y: "amount" },
    }
    for (const config of [line, bar]) {
      const result = validateDisplayConfig(config, { mode: "data", dataset })
      expect(result.valid).toBe(false)
      expect(result.issues.some((i) => i.code === "DUPLICATE_COORDINATE")).toBe(true)
    }
  })

  it("correlation 校验非数值列", () => {
    const config: DisplayConfig = {
      chartType: "correlation",
      mapping: { chartType: "correlation", columns: ["amount", "customer_name"], method: "pearson" },
    }
    const result = validateDisplayConfig(config, { mode: "data", dataset })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.code === "INCOMPATIBLE_TYPE")).toBe(true)
  })

  it("高基数分类列产生 HIGH_CARDINALITY 警告", () => {
    const manyRows = Array.from({ length: 60 }, (_, i) => ({
      customer_name: `name_${i}`,
      amount: i,
    }))
    const config: DisplayConfig = {
      chartType: "bar",
      mapping: { chartType: "bar", x: "customer_name", y: "amount" },
    }
    const result = validateDisplayConfig(config, {
      mode: "data",
      dataset: {
        columns: [
          { name: "customer_name", type: "text", semanticType: "categorical" },
          { name: "amount", type: "numeric", semanticType: "numeric" },
        ],
        rows: manyRows,
      },
    })
    expect(result.valid).toBe(true)
    expect(result.issues.some((i) => i.code === "HIGH_CARDINALITY" && i.severity === "warning")).toBe(true)
  })
})
