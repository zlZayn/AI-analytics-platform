import { useMemo } from "react"

/**
 * Group data by x and color keys, producing wide-format data for grouped charts.
 * Uses Map indexing for O(n) performance instead of O(n^2) data.find.
 */
export function useGroupedData(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  colorKey?: string,
) {
  return useMemo(() => {
    if (!colorKey) return { groups: [], wideData: data }

    const groups = Array.from(
      new Set(data.map((d) => String(d[colorKey] ?? ""))),
    )
    const xValues = Array.from(
      new Set(data.map((d) => String(d[xKey] ?? ""))),
    )

    // Build index: "xVal|group" -> yValue
    const index = new Map<string, unknown>()
    for (const d of data) {
      const key = String(d[xKey]) + "|" + String(d[colorKey])
      index.set(key, d[yKey])
    }

    const wideData = xValues.map((xVal) => {
      const row: Record<string, unknown> = { [xKey]: xVal }
      for (const g of groups) {
        row[g] = index.get(xVal + "|" + g) ?? null
      }
      return row
    })

    return { groups, wideData }
  }, [data, xKey, yKey, colorKey])
}
