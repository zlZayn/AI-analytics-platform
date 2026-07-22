import { describe, expect, it } from "vitest"

import {
  computeBoxStats,
  computeCorrelation,
  computeHistogram,
  quantileType7,
} from "../algorithms"

describe("chart statistics", () => {
  it("uses Hyndman-Fan type 7 quantiles", () => {
    expect(quantileType7([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75)
    expect(quantileType7([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5)
    expect(quantileType7([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25)
  })

  it("uses observed values for box plot whiskers", () => {
    const stats = computeBoxStats([1, 2, 3, 4, 100])
    expect(stats).not.toBeNull()
    expect(stats?.whiskerLow).toBe(1)
    expect(stats?.whiskerHigh).toBe(4)
    expect(stats?.outliers).toEqual([100])
  })

  it("reports correlations as unavailable for constant or insufficient data", () => {
    expect(computeCorrelation([1], [2], "pearson")).toEqual({ value: null, sampleSize: 1 })
    expect(computeCorrelation([1, 1, 1], [1, 2, 3], "pearson")).toEqual({ value: null, sampleSize: 3 })
  })

  it("handles ranks and ties for Spearman and Kendall tau-b", () => {
    expect(computeCorrelation([1, 2, 3], [3, 2, 1], "spearman").value).toBeCloseTo(-1)
    expect(computeCorrelation([1, 1, 2], [1, 2, 3], "kendall").value).toBeCloseTo(0.816496, 5)
  })

  it("builds bounded deterministic histograms", () => {
    const histogram = computeHistogram(Array.from({ length: 100 }, (_, i) => i + 1))
    expect(histogram.method).toBe("freedman-diaconis")
    expect(histogram.bins.length).toBeGreaterThanOrEqual(5)
    expect(histogram.bins.length).toBeLessThanOrEqual(50)
    expect(histogram.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(100)
  })

  it("falls back to Sturges when the IQR is zero", () => {
    const histogram = computeHistogram([4, 4, 4, 4, 4])
    expect(histogram.method).toBe("sturges")
    expect(histogram.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(5)
  })
})
