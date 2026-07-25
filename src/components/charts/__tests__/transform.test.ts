import { describe, expect, it } from "vitest"
import { buildHeatmap, groupPieData, prepareGroupedSeries, sampleScatterData } from "../transform"

describe("chart display transforms", () => {
  it("filters invalid scatter coordinates and deterministically samples by group", () => {
    const rows = [
      { x: 1, y: 1, group: "A" }, { x: 2, y: 2, group: "A" },
      { x: 3, y: 3, group: "A" }, { x: 4, y: 4, group: "A" },
      { x: 5, y: 5, group: "B" }, { x: 6, y: 6, group: "B" },
      { x: Number.NaN, y: 7, group: "B" }, { x: 8, y: Number.POSITIVE_INFINITY, group: "A" },
      { x: null, y: 9, group: "B" },
    ]

    const first = sampleScatterData(rows, "x", "y", "group", 3)
    const second = sampleScatterData(rows, "x", "y", "group", 3)
    expect(first).toEqual(second)
    expect(first).toMatchObject({ inputCount: 9, validCount: 6, invalidCount: 3, sampled: true })
    expect(first.points).toHaveLength(3)
    expect(first.points.filter((point) => point.group === "A")).toHaveLength(2)
    expect(first.points.filter((point) => point.group === "B")).toHaveLength(1)
  })

  it("groups pie categories beyond the visible limit into an explicit other slice", () => {
    const result = groupPieData([
      { name: "A", value: 10 }, { name: "B", value: 8 },
      { name: "C", value: 6 }, { name: "D", value: 4 },
    ], "name", "value", 2)

    expect(result).toEqual({
      ok: true,
      slices: [{ name: "A", value: 10 }, { name: "B", value: 8 }, { name: "其他", value: 10 }],
      mergedCategoryCount: 2,
      categoryLimit: 2,
    })
  })

  it("rejects negative, non-finite, and zero-total pie values", () => {
    expect(groupPieData([{ name: "A", value: -1 }], "name", "value")).toMatchObject({ ok: false, code: "NEGATIVE_VALUE" })
    expect(groupPieData([{ name: "A", value: Number.NaN }], "name", "value")).toMatchObject({ ok: false, code: "NON_FINITE_VALUE" })
    expect(groupPieData([{ name: "A", value: null }], "name", "value")).toMatchObject({ ok: false, code: "NON_FINITE_VALUE" })
    expect(groupPieData([{ name: "A", value: 0 }], "name", "value")).toMatchObject({ ok: false, code: "ZERO_TOTAL" })
  })

  it("keeps missing heatmap cells distinct from zero and rejects duplicate coordinates", () => {
    const result = buildHeatmap([
      { x: "a", y: "u", value: 0 },
      { x: "b", y: "u", value: 5 },
      { x: "b", y: "v", value: -1 },
    ], "x", "y", "value")

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.scale).toBe("diverging")
    expect(result.matrix).toEqual([[0, 5], [null, -1]])

    expect(buildHeatmap([
      { x: "a", y: "u", value: 1 },
      { x: "a", y: "u", value: 2 },
    ], "x", "y", "value")).toMatchObject({ ok: false, code: "DUPLICATE_COORDINATE" })

    expect(buildHeatmap([
      { x: "visible", y: "row", value: 1 },
      { x: "hidden", y: "row", value: 2 },
      { x: "hidden", y: "row", value: 3 },
    ], "x", "y", "value", 1)).toMatchObject({ ok: false, code: "DUPLICATE_COORDINATE" })
  })

  it("sorts temporal lines and rejects duplicate x plus group coordinates", () => {
    const sorted = prepareGroupedSeries([
      { day: "2026-02-01", value: 2 },
      { day: "2026-01-01", value: 1 },
    ], "day", "value", undefined, true)
    expect(sorted).toMatchObject({ ok: true, groups: [] })
    if (sorted.ok) expect(sorted.wideData.map((row) => row.day)).toEqual(["2026-01-01", "2026-02-01"])

    expect(prepareGroupedSeries([
      { day: "2026-01-01", group: "A", value: 1 },
      { day: "2026-01-01", group: "A", value: 2 },
    ], "day", "value", "group", true)).toMatchObject({ ok: false, code: "DUPLICATE_COORDINATE" })
  })
})
