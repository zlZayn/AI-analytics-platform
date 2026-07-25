export interface ScatterTransform {
  points: Record<string, unknown>[]
  inputCount: number
  validCount: number
  invalidCount: number
  sampled: boolean
  limit: number
}

export type PieTransform =
  | { ok: true; slices: Array<{ name: string; value: number }>; mergedCategoryCount: number; categoryLimit: number }
  | { ok: false; code: "NEGATIVE_VALUE" | "NON_FINITE_VALUE" | "ZERO_TOTAL"; message: string }

export type HeatmapTransform =
  | {
      ok: true
      matrix: Array<Array<number | null>>
      xLabels: string[]
      yLabels: string[]
      min: number
      max: number
      scale: "sequential" | "diverging"
      truncated: boolean
    }
  | { ok: false; code: "DUPLICATE_COORDINATE" | "NON_FINITE_VALUE"; message: string }

export type GroupedSeriesTransform =
  | { ok: true; groups: string[]; wideData: Record<string, unknown>[] }
  | { ok: false; code: "DUPLICATE_COORDINATE"; message: string }

export function prepareGroupedSeries(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  groupKey?: string,
  sortTemporal = false,
  rejectDuplicates = true,
): GroupedSeriesTransform {
  const ordered = sortTemporal
    ? [...rows].sort((left, right) => Date.parse(String(left[xKey])) - Date.parse(String(right[xKey])))
    : rows
  const seen = new Set<string>()
  for (const row of ordered) {
    const coordinate = JSON.stringify([row[xKey], groupKey ? row[groupKey] : null])
    if (rejectDuplicates && seen.has(coordinate)) {
      return { ok: false, code: "DUPLICATE_COORDINATE", message: "存在重复坐标，请先在 SQL 中聚合" }
    }
    seen.add(coordinate)
  }
  if (!groupKey) return { ok: true, groups: [], wideData: ordered }

  const groups = unique(ordered.map((row) => String(row[groupKey] ?? "")))
  const xValues = unique(ordered.map((row) => String(row[xKey] ?? "")))
  const values = new Map<string, unknown>()
  for (const row of ordered) values.set(JSON.stringify([String(row[xKey] ?? ""), String(row[groupKey] ?? "")]), row[yKey])
  const wideData = xValues.map((x) => {
    const row: Record<string, unknown> = { [xKey]: x }
    for (const group of groups) row[group] = values.get(JSON.stringify([x, group])) ?? null
    return row
  })
  return { ok: true, groups, wideData }
}

export function sampleScatterData(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  groupKey?: string,
  requestedLimit = 2000,
): ScatterTransform {
  const limit = Math.max(1, Math.floor(requestedLimit))
  const valid = rows.filter((row) => finiteNumber(row[xKey]) !== null && finiteNumber(row[yKey]) !== null)
  if (valid.length <= limit) {
    return { points: valid, inputCount: rows.length, validCount: valid.length, invalidCount: rows.length - valid.length, sampled: false, limit }
  }

  const groups = new Map<string, Record<string, unknown>[]>()
  for (const row of valid) {
    const key = groupKey ? String(row[groupKey] ?? "") : "__all__"
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const allocations = [...groups.entries()].map(([key, points], order) => {
    const exact = points.length / valid.length * limit
    return { key, points, order, count: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let remaining = limit - allocations.reduce((sum, allocation) => sum + allocation.count, 0)
  for (const allocation of [...allocations].sort((a, b) => b.remainder - a.remainder || a.order - b.order)) {
    if (remaining === 0) break
    allocation.count += 1
    remaining -= 1
  }

  const points = allocations.flatMap(({ points: group, count }) => selectEvenly(group, count))
  return { points, inputCount: rows.length, validCount: valid.length, invalidCount: rows.length - valid.length, sampled: true, limit }
}

export function groupPieData(
  rows: Record<string, unknown>[],
  nameKey: string,
  valueKey: string,
  requestedLimit = 8,
): PieTransform {
  const categoryLimit = Math.min(20, Math.max(1, Math.floor(requestedLimit)))
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const value = finiteNumber(row[valueKey])
    if (value === null) return { ok: false, code: "NON_FINITE_VALUE", message: "饼图数值必须是有限数字" }
    if (value < 0) return { ok: false, code: "NEGATIVE_VALUE", message: "饼图不支持负值，请调整 SQL 或改用其他图表" }
    const name = String(row[nameKey] ?? "未知")
    grouped.set(name, (grouped.get(name) ?? 0) + value)
  }

  const categories = [...grouped.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "zh-CN"))
  if (categories.reduce((sum, category) => sum + category.value, 0) === 0) {
    return { ok: false, code: "ZERO_TOTAL", message: "饼图数值总和必须大于 0" }
  }

  const slices = categories.slice(0, categoryLimit)
  const remainder = categories.slice(categoryLimit)
  if (remainder.length > 0) {
    const otherValue = remainder.reduce((sum, category) => sum + category.value, 0)
    const existing = slices.find((slice) => slice.name === "其他")
    if (existing) existing.value += otherValue
    else slices.push({ name: "其他", value: otherValue })
  }
  return { ok: true, slices, mergedCategoryCount: remainder.length, categoryLimit }
}

export function buildHeatmap(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  valueKey: string,
  requestedLimit = 20,
): HeatmapTransform {
  const limit = Math.max(1, Math.floor(requestedLimit))
  const allX = unique(rows.map((row) => String(row[xKey] ?? "")))
  const allY = unique(rows.map((row) => String(row[yKey] ?? "")))
  const xLabels = allX.slice(0, limit)
  const yLabels = allY.slice(0, limit)
  const visibleX = new Set(xLabels)
  const visibleY = new Set(yLabels)
  const values = new Map<string, number | null>()
  const seenCoordinates = new Set<string>()

  for (const row of rows) {
    const x = String(row[xKey] ?? "")
    const y = String(row[yKey] ?? "")
    const key = JSON.stringify([x, y])
    if (seenCoordinates.has(key)) return { ok: false, code: "DUPLICATE_COORDINATE", message: "热力图存在重复坐标，请先在 SQL 中聚合" }
    seenCoordinates.add(key)
    const raw = row[valueKey]
    const value = finiteNumber(raw)
    if (raw !== null && raw !== undefined && raw !== "" && value === null) {
      return { ok: false, code: "NON_FINITE_VALUE", message: "热力图数值必须是有限数字" }
    }
    if (!visibleX.has(x) || !visibleY.has(y)) continue
    if (value === null) values.set(key, null)
    else {
      values.set(key, value)
    }
  }

  const matrix = yLabels.map((y) => xLabels.map((x) => values.get(JSON.stringify([x, y])) ?? null))
  const finite = matrix.flat().filter((value): value is number => value !== null)
  const min = finite.length ? Math.min(...finite) : 0
  const max = finite.length ? Math.max(...finite) : 0
  return {
    ok: true,
    matrix,
    xLabels,
    yLabels,
    min,
    max,
    scale: min < 0 ? "diverging" : "sequential",
    truncated: allX.length > limit || allY.length > limit,
  }
}

function selectEvenly<T>(values: T[], count: number): T[] {
  if (count <= 0) return []
  if (count >= values.length) return values
  return Array.from({ length: count }, (_, index) => values[Math.floor(index * values.length / count)])
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}
