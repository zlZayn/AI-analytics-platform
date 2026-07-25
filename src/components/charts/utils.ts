import { COLORS } from "./constants"

export function getColor(index: number): string {
  return COLORS[index % COLORS.length]
}

export function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return "-"
  const num = Number(value)
  if (isNaN(num)) return String(value)
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + "M"
  if (Math.abs(num) >= 1e4) return (num / 1e3).toFixed(1) + "K"
  return num.toLocaleString("zh-CN", { maximumFractionDigits: 2 })
}

export function TooltipFormatter(value: unknown, name: unknown): [string, string] {
  return [formatNumber(value), String(name ?? "")]
}
