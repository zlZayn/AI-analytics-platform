export const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
  "#6366f1", "#14b8a6", "#e11d48", "#84cc16",
]

export const AXIS_CONFIG = {
  tick: { fontSize: 11, fill: "#6b7280" },
  tickLine: false as const,
  axisLine: { stroke: "#e5e7eb" },
}

export const GRID_CONFIG = {
  strokeDasharray: "3 3" as const,
  stroke: "#f0f0f0",
}

export const MAX_HEATMAP_ENTRIES = 20
export const MAX_CORR_COLUMNS = 10
export const MAX_CORR_ROWS = 100
