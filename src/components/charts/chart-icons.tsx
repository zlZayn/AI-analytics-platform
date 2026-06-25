"use client"

import { LineChart, BarChart3, PieChart, ScatterChart, Table2, Grid3X3, Box } from "lucide-react"
import type { ChartType } from "@/lib/variable-types"

const ICON_MAP: Record<ChartType, React.ComponentType<{ className?: string }>> = {
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  scatter: ScatterChart,
  boxplot: Box,
  correlation: Grid3X3,
  table: Table2,
}

export function ChartIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICON_MAP[type as ChartType]
  if (!Icon) return <Table2 className={className} />
  return <Icon className={className} />
}
