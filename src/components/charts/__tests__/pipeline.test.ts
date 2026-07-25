import { describe, expect, it } from "vitest"

import { createMappingForChart, profileData, recommendCharts, validateChartMapping } from "../pipeline"

const columns = [
  { name: "day", type: "date" },
  { name: "region", type: "varchar" },
  { name: "sales", type: "numeric" },
]

const rows = [
  { day: "2026-01-01", region: "华东", sales: 10 },
  { day: "2026-01-02", region: "华南", sales: 12 },
  { day: "2026-01-03", region: "华东", sales: null },
]

describe("chart pipeline", () => {
  it("profiles every returned row and preserves database type", () => {
    const profile = profileData(columns, rows)
    expect(profile.rowCount).toBe(3)
    expect(profile.columns.find((column) => column.name === "day")?.semanticType).toBe("temporal")
    expect(profile.columns.find((column) => column.name === "sales")).toMatchObject({
      databaseType: "numeric",
      semanticType: "numeric",
      nullCount: 1,
      validCount: 2,
    })
  })

  it("returns explainable recommendations without changing the selected chart", () => {
    const profile = profileData(columns, rows)
    const recommendations = recommendCharts(profile)
    expect(recommendations[0]).toMatchObject({ chartType: "line" })
    expect(recommendations[0].reason).toContain("时间")
  })

  it("creates legal defaults only after the user selects a chart type", () => {
    const profile = profileData(columns, rows)
    expect(createMappingForChart("pie", profile)).toEqual({ chartType: "pie", name: "region", value: "sales" })
    expect(createMappingForChart("heatmap", profile)).toEqual({ chartType: "heatmap", x: "region", y: "day", value: "sales" })
    expect(createMappingForChart("correlation", profile)).toEqual({ chartType: "correlation", columns: ["sales"], method: "pearson" })
  })

  it("rejects duplicate line coordinates instead of overwriting them", () => {
    const duplicateRows = [...rows, { day: "2026-01-01", region: "华东", sales: 20 }]
    const result = validateChartMapping(
      { chartType: "line", x: "day", y: "sales", color: "region", showLegend: true },
      profileData(columns, duplicateRows),
      duplicateRows,
    )
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === "DUPLICATE_COORDINATE")).toBe(true)
  })
})
