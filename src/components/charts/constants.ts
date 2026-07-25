export const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-accent)", "var(--chart-positive)", "var(--chart-negative)",
]

export const AXIS_CONFIG = {
  tick: { fontSize: 11, fill: "var(--chart-tick)" },
  tickLine: false as const,
  axisLine: { stroke: "var(--border)" },
}

export const GRID_CONFIG = {
  strokeDasharray: "3 3" as const,
  stroke: "var(--chart-grid)",
}

export const MAX_HEATMAP_ENTRIES = 20
export const MAX_CORR_COLUMNS = 20
export const MAX_CORR_ROWS = 2000
