import type { ChartMapping, ChartType } from "./types"
import { getMappingSlot, type ChartMappingSlot } from "./mapping"
import { createChartMapping } from "./mapping"

export type SemanticType = "numeric" | "temporal" | "categorical" | "boolean" | "identifier" | "text" | "unknown"
export interface ColumnProfile { name: string; databaseType: string; semanticType: SemanticType; validCount: number; nullCount: number; invalidCount: number; uniqueCount: number; min?: number | string; max?: number | string; sorted: "ascending" | "descending" | "none" }
export interface DataProfile { rowCount: number; columns: ColumnProfile[] }
export interface ChartRecommendation { chartType: ChartType; mapping: ChartMapping; reason: string; score: number }
export interface MappingIssue { code: string; message: string; field?: string; severity: "error" | "warning" }
export interface MappingValidation { valid: boolean; issues: MappingIssue[] }

const NUMERIC_TYPES = /int|numeric|decimal|real|double|float|serial|money/i
const TEMPORAL_TYPES = /date|time|timestamp|interval/i

function semanticType(name: string, databaseType: string, values: unknown[], uniqueCount: number): SemanticType {
  if (NUMERIC_TYPES.test(databaseType)) return /(^id$|_id$)/i.test(name) ? "identifier" : "numeric"
  if (TEMPORAL_TYPES.test(databaseType)) return "temporal"
  if (/bool/i.test(databaseType)) return "boolean"
  const present = values.filter((value) => value !== null && value !== undefined && value !== "")
  if (/(^id$|_id$|uuid)/i.test(name)) return "identifier"
  if (present.length > 0 && present.every((value) => Number.isFinite(Number(value)))) return "numeric"
  if (present.length > 0 && present.every((value) => !Number.isNaN(Date.parse(String(value))))) return "temporal"
  if (uniqueCount <= Math.max(20, Math.ceil(values.length * 0.2))) return "categorical"
  return present.length ? "text" : "unknown"
}

function direction(values: Array<number | string>): ColumnProfile["sorted"] {
  if (values.length < 2) return "none"
  let ascending = true; let descending = true
  for (let i = 1; i < values.length; i += 1) { if (values[i] < values[i - 1]) ascending = false; if (values[i] > values[i - 1]) descending = false }
  return ascending ? "ascending" : descending ? "descending" : "none"
}

export function profileData(columns: { name: string; type: string }[], rows: Record<string, unknown>[]): DataProfile {
  return { rowCount: rows.length, columns: columns.map((column) => {
    const values = rows.map((row) => row[column.name])
    const present = values.filter((value) => value !== null && value !== undefined && value !== "")
    const uniqueCount = new Set(present.map(String)).size
    const kind = semanticType(column.name, column.type, values, uniqueCount)
    const comparable = present.map((value) => kind === "numeric" ? Number(value) : kind === "temporal" ? Date.parse(String(value)) : String(value)).filter((value) => typeof value === "string" || Number.isFinite(value))
    return { name: column.name, databaseType: column.type, semanticType: kind, validCount: comparable.length, nullCount: values.length - present.length, invalidCount: present.length - comparable.length, uniqueCount, min: comparable.length ? comparable.reduce((a, b) => a < b ? a : b) : undefined, max: comparable.length ? comparable.reduce((a, b) => a > b ? a : b) : undefined, sorted: direction(comparable) }
  }) }
}

export function recommendCharts(profile: DataProfile): ChartRecommendation[] {
  const numeric = profile.columns.filter((column) => column.semanticType === "numeric")
  const temporal = profile.columns.find((column) => column.semanticType === "temporal")
  const categorical = profile.columns.find((column) => column.semanticType === "categorical")
  const recommendations: ChartRecommendation[] = []
  if (temporal && numeric[0]) recommendations.push({ chartType: "line", mapping: { chartType: "line", x: temporal.name, y: numeric[0].name, showLegend: true }, reason: "时间列与数值列适合展示趋势", score: 95 })
  if (categorical && numeric[0]) recommendations.push({ chartType: "bar", mapping: { chartType: "bar", x: categorical.name, y: numeric[0].name, showLegend: true }, reason: "类别与数值列适合比较", score: 85 })
  if (numeric.length >= 2) recommendations.push({ chartType: "scatter", mapping: { chartType: "scatter", x: numeric[0].name, y: numeric[1].name }, reason: "两个数值列适合观察关系", score: 75 })
  if (numeric[0]) recommendations.push({ chartType: "histogram", mapping: { chartType: "histogram", value: numeric[0].name }, reason: "数值列适合查看分布", score: 65 })
  return recommendations.sort((a, b) => b.score - a.score)
}

export function createMappingForChart(chartType: ChartType, profile: DataProfile): ChartMapping {
  const numeric = profile.columns.filter((column) => column.semanticType === "numeric").map((column) => column.name)
  const temporal = profile.columns.filter((column) => column.semanticType === "temporal").map((column) => column.name)
  const discrete = profile.columns
    .filter((column) => column.semanticType === "categorical" || column.semanticType === "text")
    .map((column) => column.name)
  const categorical = [...discrete, ...temporal]
  const category = categorical[0]

  switch (chartType) {
    case "line": return { chartType, x: temporal[0] ?? category, y: numeric[0] }
    case "bar": return { chartType, x: category, y: numeric[0], mode: "grouped" }
    case "pie": return { chartType, name: category, value: numeric[0] }
    case "scatter": return { chartType, x: numeric[0], y: numeric[1] }
    case "boxplot": return { chartType, category, value: numeric[0] }
    case "heatmap": return { chartType, x: category, y: categorical.find((column) => column !== category), value: numeric[0] }
    case "correlation": return { chartType, columns: numeric.slice(0, 20), method: "pearson" }
    case "kpi": return { chartType, value: numeric[0] }
    case "histogram": return { chartType, value: numeric[0] }
    default: return createChartMapping(chartType)
  }
}

export function validateChartMapping(mapping: ChartMapping, profile: DataProfile, rows: Record<string, unknown>[]): MappingValidation {
  const required: Partial<Record<ChartType, Array<[ChartMappingSlot, SemanticType[]]>>> = {
    line: [["x", ["temporal", "categorical", "text"]], ["y", ["numeric"]]],
    bar: [["x", ["categorical", "temporal", "text"]], ["y", ["numeric"]]],
    pie: [["name", ["categorical", "text", "temporal"]], ["value", ["numeric"]]],
    scatter: [["x", ["numeric"]], ["y", ["numeric"]]],
    boxplot: [["category", ["categorical", "text"]], ["value", ["numeric"]]],
    heatmap: [["x", ["categorical", "text", "temporal"]], ["y", ["categorical", "text", "temporal"]], ["value", ["numeric"]]],
    histogram: [["value", ["numeric"]]],
    kpi: [["value", ["numeric"]]],
  }
  const issues: MappingIssue[] = []
  for (const [field, allowed] of required[mapping.chartType] ?? []) {
    const name = getMappingSlot(mapping, field)
    const column = profile.columns.find((candidate) => candidate.name === name)
    if (!name || !column) issues.push({ code: "MISSING_MAPPING", message: `请选择${field}字段`, field, severity: "error" })
    else if (!allowed.includes(column.semanticType)) issues.push({ code: "INCOMPATIBLE_TYPE", message: `${name} 不适用于 ${field}`, field, severity: "error" })
  }
  if (mapping.chartType === "line" && mapping.x && mapping.color) {
    const seen = new Set<string>(); const duplicate = rows.some((row) => { const key = JSON.stringify([row[mapping.x!], row[mapping.color!]]); if (seen.has(key)) return true; seen.add(key); return false })
    if (duplicate) issues.push({ code: "DUPLICATE_COORDINATE", message: "存在重复坐标，请先在 SQL 中聚合", severity: "error" })
  }
  return { valid: !issues.some((issue) => issue.severity === "error"), issues }
}
