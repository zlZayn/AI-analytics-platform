// 渲染绑定（阶段四）
// 语义数据集 + 显示配置 → 图表可用的数据 + 警告 + 调整说明。
// 原则：不改动 session 状态；只在渲染期对数据与映射做展示层修正，
// 并通过 warnings（数据质量问题）与 adjustments（自动调整说明）反馈给用户。

import type { ChartMapping } from "@/components/charts/types"
import type { DisplayConfig, SemanticDataset, SemanticType } from "@/types/session"
import { getMappingSlot } from "@/components/charts/mapping"

export interface BindWarning {
  code: string
  message: string
  severity: "warning" | "info"
}

export interface BindAdjustment {
  code: string
  message: string
}

export interface BindResult {
  /** 过滤无效数值后的数据行（供图表组件直接使用） */
  rows: Record<string, unknown>[]
  /** 修正后的映射（如分类变量在数值轴时自动交换坐标） */
  mapping: ChartMapping
  /** 数据质量问题 */
  warnings: BindWarning[]
  /** 展示层自动调整说明 */
  adjustments: BindAdjustment[]
}

/** 每种图表要求数值的映射槽位（与 validators 的 REQUIRED_SLOTS 保持一致） */
const NUMERIC_SLOTS: Partial<Record<ChartMapping["chartType"], ("x" | "y" | "value")[]>> = {
  line: ["y"],
  bar: ["y"],
  scatter: ["x", "y"],
  pie: ["value"],
  boxplot: ["value"],
  heatmap: ["value"],
  histogram: ["value"],
  kpi: ["value"],
}

function isFiniteNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false
  return Number.isFinite(Number(value))
}

function columnType(dataset: SemanticDataset, field: string): SemanticType | undefined {
  return dataset.columns.find((column) => column.name === field)?.semanticType
}

function isNumericColumn(dataset: SemanticDataset, field: string): boolean {
  return columnType(dataset, field) === "numeric"
}

export function bindDataToChart(dataset: SemanticDataset, config: DisplayConfig): BindResult {
  const warnings: BindWarning[] = []
  const adjustments: BindAdjustment[] = []
  let mapping: ChartMapping = config.mapping
  let rows = dataset.rows

  // 1. 自动交换坐标轴：分类/文本字段被放在数值轴（line/bar 的 y），且另一轴为数值时
  if (mapping.chartType === "line" || mapping.chartType === "bar") {
    const xField = getMappingSlot(mapping, "x")
    const yField = getMappingSlot(mapping, "y")
    if (xField && yField && isNumericColumn(dataset, xField) && !isNumericColumn(dataset, yField)) {
      mapping = { ...mapping, x: mapping.y, y: mapping.x }
      adjustments.push({
        code: "AUTO_COORD_FLIP",
        message: `${yField} 是分类字段，已自动交换坐标轴，用 ${xField} 作为分类轴`,
      })
    }
  }

  // 2. 过滤数值槽位上的无效数值（空值 / 非有限数字）
  const numericSlots = NUMERIC_SLOTS[mapping.chartType] ?? []
  if (numericSlots.length > 0) {
    const filtered: Record<string, unknown>[] = []
    let invalid = 0
    for (const row of rows) {
      const valid = numericSlots.every((slot) => {
        const field = getMappingSlot(mapping, slot)
        return !field || isFiniteNumber(row[field])
      })
      if (valid) filtered.push(row)
      else invalid += 1
    }
    if (invalid > 0) {
      warnings.push({
        code: "INVALID_NUMERIC_FILTERED",
        message: `已过滤 ${invalid} 行包含无效数值的数据`,
        severity: "warning",
      })
    }
    rows = filtered
  }

  return { rows, mapping, warnings, adjustments }
}
