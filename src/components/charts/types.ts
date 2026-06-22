export type ChartType =
  | "line"
  | "bar"
  | "pie"
  | "scatter"
  | "histogram"
  | "boxplot"
  | "heatmap"
  | "correlation"
  | "table"

export type CorrelationMethod = "pearson" | "spearman" | "kendall"

export interface ChartMapping {
  chartType: ChartType | string
  x?: string
  y?: string
  color?: string
  fill?: string
  facet?: string
  name?: string
  value?: string
  method?: CorrelationMethod | string
  [slot: string]: string | undefined
}

export interface ChartProps {
  mapping: ChartMapping
  data: Record<string, unknown>[]
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
