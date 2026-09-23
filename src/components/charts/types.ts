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

/**
 * 图表映射槽位全部允许显式 undefined：
 * 上游（AI 契约解析、自动推荐、render-binder）按「有就填、没有就传 undefined」构造，
 * 消费处 charts/index.tsx 一律用真值判断分派，槽位取值为 undefined 与键不存在同义。
 */
export type ChartMapping =
  | ({ chartType: "line"; x?: string | undefined; y?: string | undefined; color?: string | undefined } & LegendOptions)
  | ({ chartType: "bar"; x?: string | undefined; y?: string | undefined; fill?: string | undefined; mode?: "grouped" | "stacked" | "normalized" | undefined } & LegendOptions)
  | { chartType: "pie"; name?: string | undefined; value?: string | undefined; categoryLimit?: number | undefined }
  | ({ chartType: "scatter"; x?: string | undefined; y?: string | undefined; color?: string | undefined; pointLimit?: number | undefined } & LegendOptions)
  | { chartType: "boxplot"; category?: string | undefined; value?: string | undefined }
  | { chartType: "heatmap"; x?: string | undefined; y?: string | undefined; value?: string | undefined }
  | { chartType: "correlation"; columns?: string[] | undefined; method?: CorrelationMethod | undefined }
  | { chartType: "kpi"; value?: string | undefined; label?: string | undefined; comparison?: string | undefined }
  | { chartType: "histogram"; value?: string | undefined; color?: string | undefined }
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
