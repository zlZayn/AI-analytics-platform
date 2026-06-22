import type { BoxStats } from "./types"
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TooltipFormatter(value: any, name: any): [string, string] {
  return [formatNumber(value), String(name ?? "")]
}

export function validateMapping(
  mapping: Record<string, string | undefined>,
  required: string[],
): string | null {
  for (const field of required) {
    if (!mapping[field]) return `缺少必要字段: ${field}`
  }
  return null
}

// ============================================================================
// Statistical computations
// ============================================================================

export function computeBins(
  values: number[],
  binCount?: number,
): { bin: string; count: number; start: number; end: number }[] {
  if (values.length === 0) return []

  const sorted = [...values].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  if (min === max)
    return [{ bin: String(min), count: values.length, start: min, end: max }]

  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  const binWidth = binCount
    ? (max - min) / binCount
    : iqr > 0
      ? (2 * iqr) / Math.pow(values.length, 1 / 3)
      : (max - min) / Math.sqrt(values.length)

  const effectiveBinCount =
    binCount || Math.max(1, Math.ceil((max - min) / binWidth))
  const step = (max - min) / effectiveBinCount

  const bins: { bin: string; count: number; start: number; end: number }[] = []
  for (let i = 0; i < effectiveBinCount; i++) {
    const start = min + i * step
    const end =
      i === effectiveBinCount - 1 ? max : min + (i + 1) * step
    const count = values.filter((v) =>
      i === effectiveBinCount - 1
        ? v >= start && v <= end
        : v >= start && v < end,
    ).length
    bins.push({
      bin: `${start.toFixed(1)}-${end.toFixed(1)}`,
      count,
      start,
      end,
    })
  }

  return bins
}

export function computeBoxStats(values: number[]): BoxStats | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)]
  const q1 = sorted[Math.floor(n * 0.25)]
  const q3 = sorted[Math.floor(n * 0.75)]
  const iqr = q3 - q1

  const whiskerLow = Math.max(sorted[0], q1 - 1.5 * iqr)
  const whiskerHigh = Math.min(sorted[n - 1], q3 + 1.5 * iqr)
  const outliers = sorted.filter((v) => v < whiskerLow || v > whiskerHigh)

  return {
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    median,
    q3,
    whiskerLow,
    whiskerHigh,
    outliers,
  }
}

export function computeCorrelation(
  xArr: number[],
  yArr: number[],
  method: string,
): number {
  const len = Math.min(xArr.length, yArr.length)
  if (len < 2) return 0

  if (method === "spearman") {
    const rankX = xArr.map((v) => xArr.filter((w) => w <= v).length)
    const rankY = yArr.map((v) => yArr.filter((w) => w <= v).length)
    const meanX = rankX.reduce((a, b) => a + b, 0) / len
    const meanY = rankY.reduce((a, b) => a + b, 0) / len
    let cov = 0,
      dx = 0,
      dy = 0
    for (let k = 0; k < len; k++) {
      cov += (rankX[k] - meanX) * (rankY[k] - meanY)
      dx += (rankX[k] - meanX) ** 2
      dy += (rankY[k] - meanY) ** 2
    }
    return dx && dy ? cov / Math.sqrt(dx * dy) : 0
  }

  if (method === "kendall") {
    let concordant = 0,
      discordant = 0
    for (let a = 0; a < len; a++) {
      for (let b = a + 1; b < len; b++) {
        const dx = xArr[a] - xArr[b]
        const dy = yArr[a] - yArr[b]
        if (dx * dy > 0) concordant++
        else if (dx * dy < 0) discordant++
      }
    }
    return (concordant - discordant) / (len * (len - 1) / 2 || 1)
  }

  // Pearson
  const meanX = xArr.reduce((a, b) => a + b, 0) / len
  const meanY = yArr.reduce((a, b) => a + b, 0) / len
  let cov = 0,
    dx = 0,
    dy = 0
  for (let k = 0; k < len; k++) {
    cov += (xArr[k] - meanX) * (yArr[k] - meanY)
    dx += (xArr[k] - meanX) ** 2
    dy += (yArr[k] - meanY) ** 2
  }
  return dx && dy ? cov / Math.sqrt(dx * dy) : 0
}
