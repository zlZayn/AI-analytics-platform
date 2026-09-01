// 显示配置统一校验器（阶段一）
// 双模式：
// - schema-based：用 SchemaData，根据数据库类型推断 semanticType，检查字段存在 + 类型匹配
// - data-based：用 SemanticDataset，直接读取 semanticType，额外检查重复坐标、无效数值、高基数
// 槽位类型规则从 components/charts/pipeline.ts 的 validateChartMapping 迁移，并增加 boolean 支持。

import type { ChartType } from "@/lib/variable-types"
import { CHART_TYPE_SLOTS } from "@/lib/variable-types"
import type { ChartMappingSlot } from "@/components/charts/mapping"
import { getMappingSlot } from "@/components/charts/mapping"
import type { DisplayConfig, SemanticType } from "@/types/session"
import type { SchemaData } from "@/types"

export interface ValidationIssue {
  code: string
  message: string
  field?: string
  severity: "error" | "warning"
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

export type ValidationContext =
  | { mode: "schema"; schema: SchemaData }
  | { mode: "data"; dataset: { columns: { name: string; semanticType: SemanticType }[]; rows: Record<string, unknown>[] } }

const NUMERIC_TYPES = /int|numeric|decimal|real|double|float|serial|money/i
const TEMPORAL_TYPES = /date|time|timestamp|interval/i

/** 根据数据库类型 + 列名推断语义类型（schema-based 模式使用） */
export function inferSemanticType(name: string, databaseType: string): SemanticType {
  if (NUMERIC_TYPES.test(databaseType)) return /(^id$|_id$)/i.test(name) ? "identifier" : "numeric"
  if (TEMPORAL_TYPES.test(databaseType)) return "temporal"
  if (/bool/i.test(databaseType)) return "boolean"
  if (/(^id$|_id$|uuid)/i.test(name)) return "identifier"
  if (/varchar|char|text/i.test(databaseType)) return "text"
  return "unknown"
}

/** 每种图表必填槽位允许的语义类型（boolean 作为离散分类加入） */
const REQUIRED_SLOTS: Partial<Record<ChartType, Array<[ChartMappingSlot, SemanticType[]]>>> = {
  line: [["x", ["temporal", "categorical", "text", "boolean"]], ["y", ["numeric"]]],
  bar: [["x", ["categorical", "temporal", "text", "boolean"]], ["y", ["numeric"]]],
  pie: [["name", ["categorical", "text", "temporal", "boolean"]], ["value", ["numeric"]]],
  scatter: [["x", ["numeric"]], ["y", ["numeric"]]],
  boxplot: [["category", ["categorical", "text", "boolean"]], ["value", ["numeric"]]],
  heatmap: [
    ["x", ["categorical", "text", "temporal", "boolean"]],
    ["y", ["categorical", "text", "temporal", "boolean"]],
    ["value", ["numeric"]],
  ],
  histogram: [["value", ["numeric"]]],
  kpi: [["value", ["numeric"]]],
}

// ---- 工具函数 ----

function resolveColumn(
  context: ValidationContext,
  name: string,
): { name: string; semanticType: SemanticType } | undefined {
  if (context.mode === "data") {
    return context.dataset.columns.find((c) => c.name === name)
  }
  for (const table of context.schema.tables) {
    const col = table.columns.find((c) => c.name === name)
    if (col) return { name: col.name, semanticType: inferSemanticType(col.name, col.type) }
  }
  return undefined
}

function uniqueCount(rows: Record<string, unknown>[], field: string): number {
  const seen = new Set<string>()
  for (const row of rows) {
    const v = row[field]
    if (v !== null && v !== undefined && v !== "") seen.add(String(v))
  }
  return seen.size
}

function countInvalidNumeric(rows: Record<string, unknown>[], field: string): number {
  let n = 0
  for (const row of rows) {
    const v = row[field]
    if (v !== null && v !== undefined && v !== "" && !Number.isFinite(Number(v))) n += 1
  }
  return n
}

function hasDuplicateCoordinate(
  rows: Record<string, unknown>[],
  a: string,
  b?: string,
): boolean {
  const seen = new Set<string>()
  return rows.some((row) => {
    const key = JSON.stringify([row[a], b ? row[b] : undefined])
    if (seen.has(key)) return true
    seen.add(key)
    return false
  })
}

// ---- 主校验入口 ----

/**
 * 校验显示配置是否可渲染。
 * @param config 显示配置（chartType + mapping）
 * @param context 校验上下文：schema 模式或 data 模式
 */
export function validateDisplayConfig(
  config: DisplayConfig,
  context: ValidationContext,
): ValidationResult {
  const issues: ValidationIssue[] = []
  const { chartType, mapping } = config
  const rows = context.mode === "data" ? context.dataset.rows : []

  for (const [slot, allowed] of REQUIRED_SLOTS[chartType] ?? []) {
    const field = getMappingSlot(mapping, slot)
    const slotLabel = CHART_TYPE_SLOTS[chartType][slot]?.label ?? slot
    if (!field) {
      issues.push({
        code: "MISSING_MAPPING",
        message: `请选择${slotLabel}字段`,
        field: slot,
        severity: "error",
      })
      continue
    }
    const column = resolveColumn(context, field)
    if (!column) {
      issues.push({
        code: "COLUMN_NOT_FOUND",
        message: `字段不存在: ${field}`,
        field: slot,
        severity: "error",
      })
      continue
    }
    if (!allowed.includes(column.semanticType)) {
      issues.push({
        code: "INCOMPATIBLE_TYPE",
        message: `${field} 不适用于 ${slotLabel}`,
        field: slot,
        severity: "error",
      })
      continue
    }
    // data 模式的额外检查
    if (context.mode === "data") {
      if (allowed.includes("numeric")) {
        const invalid = countInvalidNumeric(rows, field)
        if (invalid > 0) {
          issues.push({
            code: "INVALID_NUMERIC",
            message: `${field} 有 ${invalid} 个无效数值`,
            field: slot,
            severity: "warning",
          })
        }
      }
      if (column.semanticType === "categorical" || column.semanticType === "text") {
        const unique = uniqueCount(rows, field)
        if (unique > 50) {
          issues.push({
            code: "HIGH_CARDINALITY",
            message: `${field} 有 ${unique} 个唯一值，图表可能过于拥挤`,
            field: slot,
            severity: "warning",
          })
        }
      }
    }
  }

  // 重复坐标检查（line / bar）
  if (context.mode === "data" && (chartType === "line" || chartType === "bar")) {
    const x = getMappingSlot(mapping, "x")
    const group = getMappingSlot(mapping, chartType === "line" ? "color" : "fill")
    if (x && hasDuplicateCoordinate(rows, x, group)) {
      issues.push({
        code: "DUPLICATE_COORDINATE",
        message: "存在重复坐标，请先在 SQL 中聚合",
        severity: "error",
      })
    }
  }

  // correlation：所有列必须存在且为数值
  if (chartType === "correlation" && mapping.chartType === "correlation") {
    for (const field of mapping.columns ?? []) {
      const column = resolveColumn(context, field)
      if (!column) {
        issues.push({
          code: "COLUMN_NOT_FOUND",
          message: `字段不存在: ${field}`,
          severity: "error",
        })
      } else if (column.semanticType !== "numeric") {
        issues.push({
          code: "INCOMPATIBLE_TYPE",
          message: `${field} 不是数值列，不适合相关分析`,
          severity: "error",
        })
      }
    }
  }

  return { valid: !issues.some((issue) => issue.severity === "error"), issues }
}
