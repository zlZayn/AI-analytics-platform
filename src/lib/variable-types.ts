/**
 * 图表类型系统
 *
 * 核心原则：
 * 1. 图表只负责接收数据并绘制，不做复杂推断
 * 2. 复杂计算交给 SQL 或 utils.ts 中的固定算法
 * 3. 用户完全控制列到轴的映射
 */

// ---- 图表类型 ----

export type ChartType =
  | "line"
  | "bar"
  | "pie"
  | "scatter"
  | "boxplot"
  | "heatmap"
  | "correlation"
  | "kpi"
  | "histogram"
  | "table"

export type CorrelationMethod = "pearson" | "spearman" | "kendall"

// ---- 映射槽位 ----

export interface MappingSlot {
  label: string
  required: boolean
}

/**
 * 每种图表需要的列映射槽位
 * - required: 必填，不选则提示
 * - 可选槽位不强制，用户按需选择
 */
export const CHART_TYPE_SLOTS: Record<ChartType, Record<string, MappingSlot>> = {
  line: {
    x: { label: "X 轴", required: true },
    y: { label: "Y 轴", required: true },
    color: { label: "分组", required: false },
  },
  bar: {
    x: { label: "分类", required: true },
    y: { label: "数值", required: true },
    fill: { label: "分组", required: false },
  },
  pie: {
    name: { label: "名称", required: true },
    value: { label: "数值", required: true },
  },
  scatter: {
    x: { label: "X 轴", required: true },
    y: { label: "Y 轴", required: true },
    color: { label: "分组", required: false },
  },
  boxplot: {
    category: { label: "分组", required: true },
    value: { label: "数值", required: true },
  },
  heatmap: {
    x: { label: "X 轴", required: true },
    y: { label: "Y 轴", required: true },
    value: { label: "数值", required: true },
  },
  correlation: {
    columns: { label: "数值列(多选)", required: true },
  },
  kpi: {
    value: { label: "指标值", required: true },
    label: { label: "标题", required: false },
    comparison: { label: "对比值", required: false },
  },
  histogram: {
    value: { label: "数值", required: true },
    color: { label: "分组", required: false },
  },
  table: {},
}

/**
 * 图表类型信息
 */
export const CHART_TYPE_INFO: Record<ChartType, { label: string; description: string }> = {
  line: { label: "折线图", description: "展示趋势变化" },
  bar: { label: "柱状图", description: "分类对比" },
  pie: { label: "饼图", description: "占比分析" },
  scatter: { label: "散点图", description: "变量关系" },
  boxplot: { label: "箱线图", description: "分布统计" },
  heatmap: { label: "热力图", description: "矩阵分布" },
  correlation: { label: "相关矩阵", description: "变量相关性" },
  kpi: { label: "指标卡", description: "展示核心单值指标" },
  histogram: { label: "直方图", description: "展示连续数值分布" },
  table: { label: "表格", description: "原始数据" },
}

/**
 * 根据列名关键字自动填充映射
 * 不做智能推断，纯关键字匹配
 */
export function inferMapping(
  columns: { name: string }[],
  chartType: ChartType,
): Record<string, string> {
  const mapping: Record<string, string> = {}
  const slots = CHART_TYPE_SLOTS[chartType]

  if (chartType === "table" || chartType === "correlation") {
    return mapping
  }

  const colNames = columns.map((c) => c.name)
  Object.keys(slots).forEach((slot, i) => {
    if (colNames[i]) {
      mapping[slot] = colNames[i]
    }
  })

  return mapping
}
