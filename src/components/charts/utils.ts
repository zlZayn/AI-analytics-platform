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
// 固定统计算法
// ============================================================================

/**
 * 计算箱线图统计量
 */
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

/**
 * 联合过滤 NaN，保持行对齐
 */
function filterPaired(
  xArr: number[],
  yArr: number[],
): [number[], number[]] {
  const xResult: number[] = []
  const yResult: number[] = []
  const len = Math.min(xArr.length, yArr.length)
  for (let i = 0; i < len; i++) {
    if (!isNaN(xArr[i]) && !isNaN(yArr[i])) {
      xResult.push(xArr[i])
      yResult.push(yArr[i])
    }
  }
  return [xResult, yResult]
}

/**
 * Pearson 相关系数
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const [xA, yA] = filterPaired(x, y)
  const n = xA.length
  if (n < 2) return 0

  const meanX = xA.reduce((a, b) => a + b, 0) / n
  const meanY = yA.reduce((a, b) => a + b, 0) / n

  let numerator = 0
  let denomX = 0
  let denomY = 0

  for (let i = 0; i < n; i++) {
    const dx = xA[i] - meanX
    const dy = yA[i] - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denominator = Math.sqrt(denomX * denomY)
  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * Spearman 秩相关系数（处理并列值）
 */
export function spearmanCorrelation(x: number[], y: number[]): number {
  const [xA, yA] = filterPaired(x, y)
  const n = xA.length
  if (n < 2) return 0

  const rankX = toRanks(xA)
  const rankY = toRanks(yA)

  return pearsonCorrelation(rankX, rankY)
}

/**
 * 转换为平均秩（处理并列值）
 */
function toRanks(arr: number[]): number[] {
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(arr.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    // 找到所有并列值
    while (j < indexed.length && indexed[j].v === indexed[i].v) {
      j++
    }
    // 并列值取平均秩
    const avgRank = (i + 1 + j) / 2
    for (let k = i; k < j; k++) {
      ranks[indexed[k].i] = avgRank
    }
    i = j
  }
  return ranks
}

/**
 * Kendall tau-b 相关系数（处理并列值）
 */
export function kendallCorrelation(x: number[], y: number[]): number {
  const [xA, yA] = filterPaired(x, y)
  const n = xA.length
  if (n < 2) return 0

  let concordant = 0
  let discordant = 0
  let tiedX = 0
  let tiedY = 0

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const xDiff = xA[i] - xA[j]
      const yDiff = yA[i] - yA[j]
      if (xDiff === 0) tiedX++
      if (yDiff === 0) tiedY++
      if (xDiff * yDiff > 0) concordant++
      if (xDiff * yDiff < 0) discordant++
    }
  }

  const total = (n * (n - 1)) / 2
  const denominator = Math.sqrt((total - tiedX) * (total - tiedY))
  return denominator === 0 ? 0 : (concordant - discordant) / denominator
}

/**
 * 计算相关系数（统一入口）
 */
export function computeCorrelation(
  xArr: number[],
  yArr: number[],
  method: string,
): number {
  if (method === "spearman") return spearmanCorrelation(xArr, yArr)
  if (method === "kendall") return kendallCorrelation(xArr, yArr)
  return pearsonCorrelation(xArr, yArr)
}
