import type { ChartMapping, ChartType } from "./types"

export type ChartMappingSlot =
  | "x" | "y" | "color" | "fill" | "name" | "value"
  | "category" | "label" | "comparison"

const MAPPING_SLOTS: Record<ChartType, readonly ChartMappingSlot[]> = {
  line: ["x", "y", "color"],
  bar: ["x", "y", "fill"],
  pie: ["name", "value"],
  scatter: ["x", "y", "color"],
  boxplot: ["category", "value"],
  heatmap: ["x", "y", "value"],
  correlation: [],
  kpi: ["value", "label", "comparison"],
  histogram: ["value", "color"],
  table: [],
}

export function createChartMapping(chartType: ChartType): ChartMapping {
  if (chartType === "bar") return { chartType, mode: "grouped" }
  if (chartType === "correlation") return { chartType, method: "pearson" }
  return { chartType }
}

export function getMappingSlot(mapping: ChartMapping, slot: ChartMappingSlot): string | undefined {
  if (!MAPPING_SLOTS[mapping.chartType].includes(slot)) return undefined
  const slots = mapping as ChartMapping & Partial<Record<ChartMappingSlot, string>>
  return slots[slot]
}

export function setMappingSlot(mapping: ChartMapping, slot: ChartMappingSlot, value: string): ChartMapping {
  if (!MAPPING_SLOTS[mapping.chartType].includes(slot)) return mapping
  const next = { ...mapping } as ChartMapping & Partial<Record<ChartMappingSlot, string>>
  if (value) next[slot] = value
  else delete next[slot]
  return next
}

export function isChartMappingSlot(value: string): value is ChartMappingSlot {
  return Object.values(MAPPING_SLOTS).some((slots) => slots.includes(value as ChartMappingSlot))
}
