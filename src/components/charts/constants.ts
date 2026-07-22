export const COLORS = [
  "#2563eb", "#0f766e", "#c2410c", "#7c3aed",
  "#be123c", "#0369a1", "#15803d", "#a16207",
  "#4338ca", "#0e7490", "#9f1239", "#4d7c0f",
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
