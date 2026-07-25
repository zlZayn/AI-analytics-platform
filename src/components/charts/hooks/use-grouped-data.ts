import { useMemo } from "react"
import { prepareGroupedSeries } from "../transform"

/**
 * Group data by x and color keys, producing wide-format data for grouped charts.
 * Uses Map indexing for O(n) performance instead of O(n^2) data.find.
 */
export function useGroupedData(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  colorKey?: string,
  options: { sortTemporal?: boolean; rejectDuplicates?: boolean } = {},
) {
  const { sortTemporal = false, rejectDuplicates = true } = options
  return useMemo(
    () => prepareGroupedSeries(data, xKey, yKey, colorKey, sortTemporal, rejectDuplicates),
    [data, xKey, yKey, colorKey, sortTemporal, rejectDuplicates],
  )
}
