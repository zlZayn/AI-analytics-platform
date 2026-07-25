import { describe, expect, it } from "vitest"
import { computeCorrelationMatrix } from "../correlation-matrix"

describe("computeCorrelationMatrix", () => {
  it("uses pairwise deletion and reports each cell sample size", () => {
    const result = computeCorrelationMatrix([
      { a: 1, b: 2, c: null },
      { a: 2, b: null, c: 4 },
      { a: 3, b: 6, c: 6 },
      { a: 4, b: 8, c: 8 },
    ], ["a", "b", "c"], "pearson")

    expect(result.cells[0][1]).toEqual({ value: 1, sampleSize: 3 })
    expect(result.cells[1][2]).toEqual({ value: 1, sampleSize: 2 })
    expect(result.cells[0][2]).toEqual({ value: 1, sampleSize: 3 })
  })

  it("returns null for constant columns and insufficient pairs", () => {
    const result = computeCorrelationMatrix([
      { constant: 1, varying: 2, sparse: null },
      { constant: 1, varying: 4, sparse: 9 },
    ], ["constant", "varying", "sparse"], "spearman")

    expect(result.cells[0][1]).toEqual({ value: null, sampleSize: 2 })
    expect(result.cells[1][2]).toEqual({ value: null, sampleSize: 1 })
    expect(result.cells[1][1]).toEqual({ value: 1, sampleSize: 2 })
  })

  it("limits the matrix to twenty explicitly selected columns", () => {
    const columns = Array.from({ length: 22 }, (_, index) => `c${index}`)
    const result = computeCorrelationMatrix([], columns, "kendall")

    expect(result.labels).toEqual(columns.slice(0, 20))
    expect(result.truncated).toBe(true)
    expect(result.cells).toHaveLength(20)
  })
})
