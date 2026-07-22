import type { BoxStats } from "./types"

export interface CorrelationResult { value: number | null; sampleSize: number }
export interface HistogramBin { start: number; end: number; count: number }
export interface HistogramResult {
  bins: HistogramBin[]
  method: "freedman-diaconis" | "sturges"
  sampleSize: number
  invalidCount: number
}

function finiteValues(values: unknown[]): number[] {
  return values.map(Number).filter(Number.isFinite)
}

export function quantileType7(values: number[], probability: number): number {
  if (!values.length) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * Math.max(0, Math.min(1, probability))
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

export function computeBoxStats(input: number[]): BoxStats | null {
  const values = finiteValues(input).sort((a, b) => a - b)
  if (!values.length) return null
  const q1 = quantileType7(values, 0.25)
  const median = quantileType7(values, 0.5)
  const q3 = quantileType7(values, 0.75)
  const iqr = q3 - q1
  const lowFence = q1 - 1.5 * iqr
  const highFence = q3 + 1.5 * iqr
  const inliers = values.filter((value) => value >= lowFence && value <= highFence)
  return {
    min: values[0], max: values[values.length - 1], q1, median, q3,
    whiskerLow: inliers[0] ?? values[0],
    whiskerHigh: inliers[inliers.length - 1] ?? values[values.length - 1],
    outliers: values.filter((value) => value < lowFence || value > highFence),
  }
}

function pairedFinite(x: number[], y: number[]): [number[], number[]] {
  const left: number[] = []
  const right: number[] = []
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const xValue = Number(x[i]); const yValue = Number(y[i])
    if (Number.isFinite(xValue) && Number.isFinite(yValue)) { left.push(xValue); right.push(yValue) }
  }
  return [left, right]
}

function pearsonValue(x: number[], y: number[]): number | null {
  if (x.length < 2) return null
  const meanX = x.reduce((sum, value) => sum + value, 0) / x.length
  const meanY = y.reduce((sum, value) => sum + value, 0) / y.length
  let numerator = 0; let varianceX = 0; let varianceY = 0
  for (let i = 0; i < x.length; i += 1) {
    const dx = x[i] - meanX; const dy = y[i] - meanY
    numerator += dx * dy; varianceX += dx * dx; varianceY += dy * dy
  }
  const denominator = Math.sqrt(varianceX * varianceY)
  return denominator === 0 ? null : numerator / denominator
}

function ranks(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const result = new Array<number>(values.length)
  for (let start = 0; start < indexed.length;) {
    let end = start + 1
    while (end < indexed.length && indexed[end].value === indexed[start].value) end += 1
    const rank = (start + 1 + end) / 2
    for (let i = start; i < end; i += 1) result[indexed[i].index] = rank
    start = end
  }
  return result
}

function tiedPairs(values: number[]): number {
  let total = 0
  for (let start = 0; start < values.length;) {
    let end = start + 1
    while (end < values.length && values[end] === values[start]) end += 1
    const count = end - start; total += count * (count - 1) / 2; start = end
  }
  return total
}

class FenwickTree {
  private readonly tree: number[]
  constructor(size: number) { this.tree = new Array(size + 1).fill(0) }
  add(index: number) { for (let i = index + 1; i < this.tree.length; i += i & -i) this.tree[i] += 1 }
  sum(index: number) { let total = 0; for (let i = index + 1; i > 0; i -= i & -i) total += this.tree[i]; return total }
}

function kendallTauB(x: number[], y: number[]): number | null {
  if (x.length < 2) return null
  const pairs = x.map((value, index) => ({ x: value, y: y[index] })).sort((a, b) => a.x - b.x || a.y - b.y)
  const uniqueY = Array.from(new Set(y)).sort((a, b) => a - b)
  const yRank = new Map(uniqueY.map((value, index) => [value, index]))
  const tree = new FenwickTree(uniqueY.length)
  let previous = 0; let discordant = 0
  for (let start = 0; start < pairs.length;) {
    let end = start + 1
    while (end < pairs.length && pairs[end].x === pairs[start].x) end += 1
    for (let i = start; i < end; i += 1) {
      const rank = yRank.get(pairs[i].y)!
      discordant += previous - tree.sum(rank)
    }
    for (let i = start; i < end; i += 1) tree.add(yRank.get(pairs[i].y)!)
    previous += end - start; start = end
  }
  const total = x.length * (x.length - 1) / 2
  const tiesX = tiedPairs([...x].sort((a, b) => a - b))
  const tiesY = tiedPairs([...y].sort((a, b) => a - b))
  let tiesBoth = 0
  for (let start = 0; start < pairs.length;) {
    let end = start + 1
    while (end < pairs.length && pairs[end].x === pairs[start].x && pairs[end].y === pairs[start].y) end += 1
    const count = end - start; tiesBoth += count * (count - 1) / 2; start = end
  }
  const denominator = Math.sqrt((total - tiesX) * (total - tiesY))
  const comparable = total - tiesX - tiesY + tiesBoth
  return denominator === 0 ? null : (comparable - 2 * discordant) / denominator
}

export function computeCorrelation(xInput: number[], yInput: number[], method: string): CorrelationResult {
  const [x, y] = pairedFinite(xInput, yInput)
  const value = method === "spearman" ? pearsonValue(ranks(x), ranks(y)) : method === "kendall" ? kendallTauB(x, y) : pearsonValue(x, y)
  return { value, sampleSize: x.length }
}

export function computeHistogram(input: unknown[], requestedBins?: number): HistogramResult {
  const values = finiteValues(input)
  const invalidCount = input.length - values.length
  if (!values.length) return { bins: [], method: "sturges", sampleSize: 0, invalidCount }
  const min = Math.min(...values); const max = Math.max(...values)
  const iqr = quantileType7(values, 0.75) - quantileType7(values, 0.25)
  const fdWidth = 2 * iqr * Math.pow(values.length, -1 / 3)
  const method = fdWidth > 0 && max > min ? "freedman-diaconis" : "sturges"
  const inferred = method === "freedman-diaconis" ? Math.ceil((max - min) / fdWidth) : Math.ceil(Math.log2(values.length) + 1)
  const count = max === min ? 1 : Math.min(50, Math.max(5, requestedBins ?? inferred))
  const width = max === min ? 1 : (max - min) / count
  const bins = Array.from({ length: count }, (_, index) => ({ start: min + index * width, end: index === count - 1 ? max : min + (index + 1) * width, count: 0 }))
  for (const value of values) bins[max === min ? 0 : Math.min(count - 1, Math.floor((value - min) / width))].count += 1
  return { bins, method, sampleSize: values.length, invalidCount }
}
