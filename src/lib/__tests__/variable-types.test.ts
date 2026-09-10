import { describe, expect, it } from "vitest"
import { CHART_TYPE_INFO, SELECTABLE_CHART_TYPES } from "@/lib/variable-types"

describe("图表类型清单", () => {
  it("可选项不含 table：表格由结果区「明细」Tab 独占", () => {
    expect(SELECTABLE_CHART_TYPES).not.toContain("table")
  })

  it("可选项覆盖除 table 外的全部类型且无重复", () => {
    const expected = Object.keys(CHART_TYPE_INFO).filter((type) => type !== "table")
    expect([...SELECTABLE_CHART_TYPES].sort()).toEqual([...expected].sort())
    expect(new Set(SELECTABLE_CHART_TYPES).size).toBe(SELECTABLE_CHART_TYPES.length)
  })
})
