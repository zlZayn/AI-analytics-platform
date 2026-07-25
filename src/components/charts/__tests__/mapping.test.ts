import { describe, expect, it } from "vitest"
import { createChartMapping, getMappingSlot, setMappingSlot } from "../mapping"

describe("chart mapping helpers", () => {
  it("creates chart-specific defaults", () => {
    expect(createChartMapping("table")).toEqual({ chartType: "table" })
    expect(createChartMapping("bar")).toEqual({ chartType: "bar", mode: "grouped" })
    expect(createChartMapping("correlation")).toEqual({ chartType: "correlation", method: "pearson" })
  })

  it("updates only slots supported by the selected chart type", () => {
    const line = setMappingSlot({ chartType: "line", x: "day" }, "y", "sales")
    expect(line).toEqual({ chartType: "line", x: "day", y: "sales" })
    expect(getMappingSlot(line, "y")).toBe("sales")
    expect(setMappingSlot(line, "name", "invalid")).toEqual(line)
  })

  it("removes an optional slot when its value is empty", () => {
    expect(setMappingSlot({ chartType: "scatter", x: "a", color: "group" }, "color", ""))
      .toEqual({ chartType: "scatter", x: "a" })
  })
})
