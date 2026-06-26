import type { ChartType, CorrelationMethod } from "@/lib/variable-types"

export type { ChartType, CorrelationMethod }

export interface ChartMapping {
  chartType: ChartType | string
  x?: string
  y?: string
  color?: string
  fill?: string
  facet?: string
  name?: string
  value?: string
  category?: string
  valueKey?: string
  method?: CorrelationMethod | string
  [slot: string]: string | undefined
}

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
