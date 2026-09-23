import type { ChartType, CorrelationMethod } from "@/lib/variable-types"

export type { ChartType, CorrelationMethod }

/** 图表数据行：列名 → 单元格值（各视图按 xKey / yKey / valueKey 等键名取用） */
export type ChartRow = Record<string, unknown>

/** xKey / yKey 族视图的公共入参（bar / box-plot / heatmap / line / scatter 同形） */
export interface XYChartProps {
  data: ChartRow[]
  xKey: string
  yKey: string
}

interface LegendOptions { showLegend?: boolean }

export type ChartMapping =
  | ({ chartType: "line"; x?: string; y?: string; color?: string } & LegendOptions)
  | ({ chartType: "bar"; x?: string; y?: string; fill?: string; mode?: "grouped" | "stacked" | "normalized" } & LegendOptions)
  | { chartType: "pie"; name?: string; value?: string; categoryLimit?: number }
  | ({ chartType: "scatter"; x?: string; y?: string; color?: string; pointLimit?: number } & LegendOptions)
  | { chartType: "boxplot"; category?: string; value?: string }
  | { chartType: "heatmap"; x?: string; y?: string; value?: string }
  | { chartType: "correlation"; columns?: string[]; method?: CorrelationMethod }
  | { chartType: "kpi"; value?: string; label?: string; comparison?: string }
  | { chartType: "histogram"; value?: string; color?: string }
  | { chartType: "table" }

export interface ChartProps {
  mapping: ChartMapping
  data: ChartRow[]
  showLegend?: boolean
  /** 视图填满容器高度（结果区「明细」Tab）；当前由表格视图消费 */
  fillHeight?: boolean
}

export interface BoxStats {
  min: number
  max: number
  q1: number
  median: number
  q3: number
  whiskerLow: number
  whiskerHigh: number
  outliers: number[]
}
