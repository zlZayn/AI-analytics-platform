/**
 * 变量类型系统 v2
 *
 * 核心思想：
 * 1. 变量类型不是固定的，而是基于数据分布推断
 * 2. 映射槽位应该灵活，允许用户覆盖默认推断
 * 3. 提供数据统计信息帮助用户决策
 */

// ---- 变量角色 ----

export type VariableRole =
  | "temporal"    // 时间/日期
  | "categorical" // 分类
  | "continuous"  // 连续数值
  | "binary"      // 二值（true/false, 0/1）
  | "id"          // 唯一标识

export interface VariableInfo {
  name: string
  type: string        // 原始数据库类型
  role: VariableRole
  stats: VariableStats
}

export interface VariableStats {
  totalCount: number     // 总行数
  nullCount: number      // 空值数
  uniqueCount: number    // 唯一值数
  nullRatio: number      // 空值比例
  uniqueRatio: number    // 唯一值比例（相对总行数）
  sampleValues: unknown[] // 样本值
  min?: number           // 最小值（数值型）
  max?: number           // 最大值（数值型）
  mean?: number          // 均值（数值型）
  isBoolean?: boolean    // 是否布尔语义
}

// ---- 变量类型推断 ----

/**
 * 推断变量角色（基于数据统计）
 */
export function inferVariableRole(
  colType: string,
  values: unknown[]
): VariableRole {
  const lower = colType.toLowerCase()
  const nonNull = values.filter((v) => v != null && v !== "")
  const unique = new Set(nonNull)
  const uniqueCount = unique.size

  // 1. 时间/日期型
  if (isTemporalType(lower)) {
    return "temporal"
  }

  // 2. 布尔型
  if (isBooleanType(lower, nonNull)) {
    return "binary"
  }

  // 3. 数值型（数据库类型）
  if (isNumericType(lower)) {
    // 检查是否是二值（0/1）
    if (uniqueCount <= 2 && nonNull.every((v) => v === 0 || v === 1 || v === "0" || v === "1")) {
      return "binary"
    }
    // 数值型直接返回 continuous，不根据唯一值数量判断
    return "continuous"
  }

  // 4. 字符串型：检查是否是数值形式
  if (isStringType(lower)) {
    // 检查值是否是数值形式（如 "90991.96"）
    const numericValues = nonNull.filter((v) => !isNaN(Number(v)))
    if (numericValues.length > nonNull.length * 0.8) {
      // 80% 以上是数值形式，视为连续数值
      if (isCategoricalByDistribution(nonNull, uniqueCount)) {
        return "categorical"
      }
      return "continuous"
    }
    return "categorical"
  }

  // 5. 默认
  return "categorical"
}

function isTemporalType(lower: string): boolean {
  return (
    lower.includes("time") ||
    lower.includes("date") ||
    lower.includes("timestamp") ||
    lower.includes("datetime")
  )
}

function isBooleanType(lower: string, values: unknown[]): boolean {
  if (lower.includes("bool")) return true
  const unique = new Set(values.map((v) => String(v).toLowerCase()))
  return unique.size === 2 &&
    (
      (unique.has("true") && unique.has("false")) ||
      (unique.has("1") && unique.has("0")) ||
      (unique.has("yes") && unique.has("no")) ||
      (unique.has("t") && unique.has("f"))
    )
}

function isNumericType(lower: string): boolean {
  return (
    lower.includes("int") ||
    lower.includes("numeric") ||
    lower.includes("float") ||
    lower.includes("decimal") ||
    lower.includes("double") ||
    lower.includes("real") ||
    lower.includes("number")
  )
}

function isStringType(lower: string): boolean {
  return (
    lower.includes("char") ||
    lower.includes("text") ||
    lower.includes("varchar") ||
    lower.includes("string") ||
    lower.includes("clob")
  )
}

/**
 * 判断是否是分类变量（基于分布）
 *
 * 规则：
 * - 唯一值 <= 20 → categorical
 * - 唯一值 <= 总行数的 5% 且 <= 50 → categorical
 * - 其他 → continuous
 */
function isCategoricalByDistribution(values: unknown[], uniqueCount: number): boolean {
  const total = values.length
  if (total === 0) return true

  // 绝对阈值
  if (uniqueCount <= 20) return true

  // 相对阈值：唯一值占比 <= 5% 且绝对值 <= 50
  const ratio = uniqueCount / total
  if (ratio <= 0.05 && uniqueCount <= 50) return true

  return false
}

// ---- 变量统计 ----

/**
 * 计算变量统计信息
 */
export function computeVariableStats(values: unknown[]): VariableStats {
  const total = values.length
  const nonNull = values.filter((v) => v != null && v !== "")
  const nullCount = total - nonNull.length
  const unique = new Set(nonNull)
  const uniqueCount = unique.size

  const stats: VariableStats = {
    totalCount: total,
    nullCount,
    uniqueCount,
    nullRatio: total > 0 ? nullCount / total : 0,
    uniqueRatio: total > 0 ? uniqueCount / total : 0,
    sampleValues: Array.from(unique).slice(0, 5),
  }

  // 数值统计
  const numericValues = nonNull.map(Number).filter((v) => !isNaN(v))
  if (numericValues.length > 0) {
    stats.min = Math.min(...numericValues)
    stats.max = Math.max(...numericValues)
    stats.mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length
  }

  // 布尔检测
  const uniqueStr = new Set(nonNull.map((v) => String(v).toLowerCase()))
  stats.isBoolean =
    uniqueStr.size === 2 &&
    ((uniqueStr.has("true") && uniqueStr.has("false")) ||
      (uniqueStr.has("1") && uniqueStr.has("0")) ||
      (uniqueStr.has("yes") && uniqueStr.has("no")))

  return stats
}

/**
 * 获取变量角色标签
 */
export function getRoleLabel(role: VariableRole): string {
  switch (role) {
    case "temporal": return "时间"
    case "categorical": return "分类"
    case "continuous": return "数值"
    case "binary": return "二值"
    case "id": return "标识"
  }
}

/**
 * 获取变量角色颜色（用于 UI）
 */
export function getRoleColor(role: VariableRole): string {
  switch (role) {
    case "temporal": return "text-blue-600 bg-blue-50 border-blue-200"
    case "categorical": return "text-orange-600 bg-orange-50 border-orange-200"
    case "continuous": return "text-green-600 bg-green-50 border-green-200"
    case "binary": return "text-purple-600 bg-purple-50 border-purple-200"
    case "id": return "text-gray-500 bg-gray-50 border-gray-200"
  }
}

// ---- 图表类型 ----

export type ChartType =
  | "line"
  | "bar"
  | "pie"
  | "scatter"
  | "histogram"
  | "boxplot"
  | "correlation"
  | "table"

export type CorrelationMethod = "pearson" | "spearman" | "kendall"

/**
 * 映射槽位定义
 */
export interface MappingSlot {
  label: string
  required: boolean
  accepts: VariableRole[]
  description?: string
}

/**
 * 每个图表类型的映射规则
 */
export const CHART_TYPE_SLOTS: Record<ChartType, Record<string, MappingSlot>> = {
  line: {
    x: { label: "X 轴", required: true, accepts: ["temporal", "categorical", "binary"], description: "横轴字段" },
    y: { label: "Y 轴", required: true, accepts: ["continuous"], description: "数值字段" },
    color: { label: "颜色", required: false, accepts: ["categorical", "binary"], description: "分组字段" },
  },
  bar: {
    x: { label: "X 轴", required: true, accepts: ["categorical", "temporal", "binary"], description: "分类字段" },
    y: { label: "Y 轴", required: true, accepts: ["continuous"], description: "数值字段" },
    fill: { label: "填充", required: false, accepts: ["categorical", "binary"], description: "分组字段" },
  },
  pie: {
    name: { label: "分类", required: true, accepts: ["categorical", "binary"], description: "分类字段" },
    value: { label: "数值", required: true, accepts: ["continuous"], description: "数值字段" },
  },
  scatter: {
    x: { label: "X 轴", required: true, accepts: ["continuous"], description: "数值字段" },
    y: { label: "Y 轴", required: true, accepts: ["continuous"], description: "数值字段" },
    color: { label: "颜色", required: false, accepts: ["categorical", "binary"], description: "分组字段" },
  },
  histogram: {
    x: { label: "变量", required: true, accepts: ["continuous"], description: "数值字段" },
    fill: { label: "分组", required: false, accepts: ["categorical", "binary"], description: "分组字段" },
  },
  boxplot: {
    x: { label: "分组", required: true, accepts: ["categorical", "binary"], description: "分类字段" },
    y: { label: "数值", required: true, accepts: ["continuous"], description: "数值字段" },
  },
  correlation: {},  // 自动提取所有数值变量
  table: {},
}

/**
 * 图表类型信息
 */
export const CHART_TYPE_INFO: Record<ChartType, { label: string; icon: string; description: string }> = {
  line: { label: "折线图", icon: "📈", description: "展示趋势变化" },
  bar: { label: "柱状图", icon: "📊", description: "分类对比" },
  pie: { label: "饼图", icon: "🥧", description: "占比分析" },
  scatter: { label: "散点图", icon: "⊙", description: "变量关系" },
  histogram: { label: "直方图", icon: "▓", description: "数据分布" },
  boxplot: { label: "箱线图", icon: "▱", description: "分布统计" },
  correlation: { label: "相关矩阵", icon: "🔗", description: "变量相关性" },
  table: { label: "表格", icon: "▦", description: "原始数据" },
}

/**
 * 自动推断图表类型
 */
export function inferChartType(variables: VariableInfo[]): ChartType {
  const temporal = variables.filter((v) => v.role === "temporal")
  const continuous = variables.filter((v) => v.role === "continuous")
  const categorical = variables.filter((v) => v.role === "categorical" || v.role === "binary")

  // 有时间 + 数值 → 折线图
  if (temporal.length > 0 && continuous.length > 0) {
    return "line"
  }

  // 有分类 + 数值 → 柱状图
  if (categorical.length > 0 && continuous.length > 0) {
    return "bar"
  }

  // 两个数值 → 散点图
  if (continuous.length >= 2) {
    return "scatter"
  }

  // 单个数值 → 直方图
  if (continuous.length === 1) {
    return "histogram"
  }

  return "table"
}

/**
 * 自动填充映射
 */
export function inferMapping(
  variables: VariableInfo[],
  chartType: ChartType
): Record<string, string> {
  const mapping: Record<string, string> = {}
  const slots = CHART_TYPE_SLOTS[chartType]

  if (chartType === "correlation" || chartType === "table") {
    return mapping
  }

  Object.entries(slots).forEach(([slot, slotDef]) => {
    if (!slotDef.required) return

    // 找第一个匹配的变量
    const match = variables.find((v) => slotDef.accepts.includes(v.role))
    if (match) {
      mapping[slot] = match.name
    }
  })

  return mapping
}

/**
 * 检查图表类型是否可用（是否有足够的变量满足必填槽位）
 */
export function isChartTypeAvailable(
  variables: VariableInfo[],
  chartType: ChartType
): boolean {
  if (chartType === "correlation") {
    return variables.filter((v) => v.role === "continuous").length >= 2
  }
  if (chartType === "table") {
    return true
  }

  const slots = CHART_TYPE_SLOTS[chartType]
  return Object.entries(slots).every(([_, slotDef]) => {
    if (!slotDef.required) return true
    return variables.some((v) => slotDef.accepts.includes(v.role))
  })
}

// ---- 相关系数计算 ----

/**
 * Pearson 相关系数
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0 || n !== y.length) return 0

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let numerator = 0
  let denomX = 0
  let denomY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denominator = Math.sqrt(denomX * denomY)
  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * Spearman 秩相关系数
 */
export function spearmanCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0 || n !== y.length) return 0

  const rankX = toRanks(x)
  const rankY = toRanks(y)

  return pearsonCorrelation(rankX, rankY)
}

function toRanks(arr: number[]): number[] {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(arr.length)
  for (let i = 0; i < sorted.length; i++) {
    ranks[sorted[i].i] = i + 1
  }
  return ranks
}

/**
 * Kendall tau-b 相关系数
 */
export function kendallCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0 || n !== y.length) return 0

  let concordant = 0
  let discordant = 0
  let tiedX = 0
  let tiedY = 0

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const xDiff = x[i] - x[j]
      const yDiff = y[i] - y[j]
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
 * 相关系数矩阵
 */
export function correlationMatrix(
  data: Record<string, unknown>[],
  columns: string[],
  method: CorrelationMethod = "pearson"
): number[][] {
  const n = columns.length
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  const numericData: Record<string, number[]> = {}
  columns.forEach((col) => {
    numericData[col] = data.map((d) => Number(d[col])).filter((v) => !isNaN(v))
  })

  const corrFn =
    method === "pearson" ? pearsonCorrelation :
    method === "spearman" ? spearmanCorrelation :
    kendallCorrelation

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1
      } else if (j > i) {
        const corr = corrFn(numericData[columns[i]], numericData[columns[j]])
        matrix[i][j] = Math.round(corr * 100) / 100
        matrix[j][i] = matrix[i][j]
      }
    }
  }

  return matrix
}
