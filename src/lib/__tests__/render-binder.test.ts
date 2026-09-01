import { describe, expect, it } from "vitest"
import { bindDataToChart } from "../render-binder"
import type { DisplayConfig, SemanticColumn, SemanticDataset } from "@/types/session"

function dataset(columns: SemanticColumn[], rows: Record<string, unknown>[]): SemanticDataset {
  return {
    columns,
    rows,
    rowCount: rows.length,
    executionTimeMs: 1,
    returnedRowCount: rows.length,
    truncated: false,
    rowLimit: 5000,
  }
}

describe("render-binder: bindDataToChart", () => {
  it("自动交换坐标轴：分类字段放在数值轴（line/bar 的 y）时翻转映射并提示", () => {
    const ds = dataset(
      [
        { name: "region", type: "text", semanticType: "categorical" },
        { name: "amount", type: "numeric", semanticType: "numeric" },
      ],
      [
        { region: "华东", amount: 100 },
        { region: "华南", amount: 200 },
      ],
    )
    const config: DisplayConfig = { chartType: "line", mapping: { chartType: "line", x: "amount", y: "region" } }
    const result = bindDataToChart(ds, config)

    expect(result.adjustments).toHaveLength(1)
    expect(result.adjustments[0].code).toBe("AUTO_COORD_FLIP")
    expect(result.mapping).toMatchObject({ chartType: "line", x: "region", y: "amount" })
    expect(result.warnings).toHaveLength(0)
  })

  it("Y 轴已是数值时不翻转，也不产生调整", () => {
    const ds = dataset(
      [
        { name: "day", type: "timestamp", semanticType: "temporal" },
        { name: "sales", type: "numeric", semanticType: "numeric" },
      ],
      [{ day: "2026-01-01", sales: 10 }],
    )
    const config: DisplayConfig = { chartType: "line", mapping: { chartType: "line", x: "day", y: "sales" } }
    const result = bindDataToChart(ds, config)

    expect(result.adjustments).toHaveLength(0)
    expect(result.mapping).toEqual({ chartType: "line", x: "day", y: "sales" })
    expect(result.rows).toHaveLength(1)
  })

  it("过滤无效数值并返回带数量的警告（bar）", () => {
    const ds = dataset(
      [
        { name: "category", type: "text", semanticType: "categorical" },
        { name: "total", type: "numeric", semanticType: "numeric" },
      ],
      [
        { category: "A", total: 10 },
        { category: "B", total: null },
        { category: "C", total: "abc" },
        { category: "D", total: 40 },
      ],
    )
    const config: DisplayConfig = { chartType: "bar", mapping: { chartType: "bar", x: "category", y: "total" } }
    const result = bindDataToChart(ds, config)

    expect(result.rows).toHaveLength(2)
    expect(result.rows.map((row) => row.category)).toEqual(["A", "D"])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe("INVALID_NUMERIC_FILTERED")
    expect(result.warnings[0].message).toContain("2")
  })

  it("散点图要求 X 与 Y 均为数值，任一无效应被过滤", () => {
    const ds = dataset(
      [
        { name: "x", type: "numeric", semanticType: "numeric" },
        { name: "y", type: "numeric", semanticType: "numeric" },
      ],
      [
        { x: 1, y: 2 },
        { x: "bad", y: 3 },
        { x: 4, y: null },
      ],
    )
    const config: DisplayConfig = { chartType: "scatter", mapping: { chartType: "scatter", x: "x", y: "y" } }
    const result = bindDataToChart(ds, config)

    expect(result.rows).toHaveLength(1)
    expect(result.warnings[0].message).toContain("2")
  })

  it("饼图过滤无效数值行", () => {
    const ds = dataset(
      [
        { name: "name", type: "text", semanticType: "categorical" },
        { name: "value", type: "numeric", semanticType: "numeric" },
      ],
      [
        { name: "A", value: 10 },
        { name: "B", value: null },
        { name: "C", value: 30 },
      ],
    )
    const config: DisplayConfig = { chartType: "pie", mapping: { chartType: "pie", name: "name", value: "value" } }
    const result = bindDataToChart(ds, config)

    expect(result.rows).toHaveLength(2)
    expect(result.warnings).toHaveLength(1)
  })

  it("表格不做任何数据修正", () => {
    const ds = dataset(
      [
        { name: "region", type: "text", semanticType: "categorical" },
        { name: "amount", type: "numeric", semanticType: "numeric" },
      ],
      [
        { region: "华东", amount: null },
        { region: "华南", amount: 200 },
      ],
    )
    const config: DisplayConfig = { chartType: "table", mapping: { chartType: "table" } }
    const result = bindDataToChart(ds, config)

    expect(result.rows).toHaveLength(2)
    expect(result.warnings).toHaveLength(0)
    expect(result.adjustments).toHaveLength(0)
    expect(result.mapping).toEqual({ chartType: "table" })
  })
})
