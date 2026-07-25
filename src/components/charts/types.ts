import type { ChartType, CorrelationMethod } from "@/lib/variable-types"

export type { ChartType, CorrelationMethod }

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
  data: Record<string, unknown>[]
  showLegend?: boolean
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
