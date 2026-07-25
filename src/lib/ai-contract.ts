import type { ChartMapping, ChartType, CorrelationMethod } from "@/components/charts/types"
import { validateSQL } from "./sql-validator"

interface ChartContract {
  required: readonly string[]
  optional: readonly string[]
  description: string
}

export const CHART_CONTRACTS: Record<ChartType, ChartContract> = {
  table: { required: [], optional: [], description: "原始结果；首次结果默认使用" },
  line: { required: ["x", "y"], optional: ["color"], description: "时间或有序类别趋势" },
  bar: { required: ["x", "y"], optional: ["fill", "mode"], description: "类别比较；mode 可为 grouped/stacked/normalized" },
  pie: { required: ["name", "value"], optional: [], description: "非负数值的部分占整体" },
  scatter: { required: ["x", "y"], optional: ["color"], description: "两个数值变量的关系" },
  boxplot: { required: ["category", "value"], optional: [], description: "按类别比较数值分布" },
  heatmap: { required: ["x", "y", "value"], optional: [], description: "两个类别维度与一个已聚合数值" },
  correlation: { required: [], optional: ["columns", "method"], description: "多个数值列的相关矩阵" },
  kpi: { required: ["value"], optional: ["label", "comparison"], description: "单行核心指标" },
  histogram: { required: ["value"], optional: ["color"], description: "连续数值分布" },
}

const CHART_TYPES = Object.keys(CHART_CONTRACTS) as ChartType[]
const COLUMN_SLOTS = new Set(["x", "y", "color", "fill", "name", "value", "category", "label", "comparison"])

export interface InsightItem {
  title: string
  insight: string
  sql: string
  chart: ChartMapping
}

const chartSchemaVariants = CHART_TYPES.map((type) => {
  const requiredSlots = [...CHART_CONTRACTS[type].required]
  return {
    type: "object",
    additionalProperties: false,
    required: ["type", "mapping"],
    properties: {
      type: { type: "string", const: type },
      mapping: {
        type: "object",
        additionalProperties: false,
        required: requiredSlots,
        properties: Object.fromEntries(requiredSlots.map((slot) => [slot, { type: "string" }])),
      },
    },
  }
})

export const AI_RESPONSE_JSON_SCHEMA = {
  name: "analytics_insights",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "insight", "sql", "chart"],
          properties: {
            title: { type: "string", maxLength: 80 },
            insight: { type: "string", maxLength: 1000 },
            sql: { type: "string" },
            chart: { anyOf: chartSchemaVariants },
          },
        },
      },
    },
  },
} as const

export function buildSystemPrompt(schemaContext: string): string {
  const chartRules = CHART_TYPES.map((type) => {
    const contract = CHART_CONTRACTS[type]
    const slots = [...contract.required, ...contract.optional]
    return `- ${type}: ${contract.description}; mapping=${slots.length ? slots.join(", ") : "{}"}`
  }).join("\n")

  return `你是数据分析工作台的 SQL 与图表建议助手。只依据下方当前连接 Schema 回答，不得假设行业、表、列或关系。

设计边界：
- 业务聚合和数据整形必须在 SQL 中完成；图表不会猜测业务语义，也不会合并重复坐标。
- 图表只是建议。首次结果保持表格，用户决定是否采用建议及其映射、排序和堆叠语义。
- SQL 必须是单条 PostgreSQL SELECT/WITH，不带分号，不得写入、锁表或调用副作用操作。
- 所有图表使用的输出列必须显式 AS 为稳定别名，mapping 只能引用这些输出别名。
- 不得静默截断、采样或改写业务数据。类别过多时应在 SQL 中合理聚合，并在 insight 中说明。
- 只返回符合 JSON Schema 的对象，不输出 Markdown、代码围栏或额外文字。

图表合同：
${chartRules}

当前连接 Schema：
${schemaContext}`
}

export function parseInsightItems(content: string): InsightItem[] {
  let root: unknown
  try {
    root = JSON.parse(content)
  } catch {
    return []
  }
  if (!isRecord(root) || !Array.isArray(root.items)) return []

  const items: InsightItem[] = []
  for (const raw of root.items.slice(0, 6)) {
    if (!isRecord(raw) || typeof raw.title !== "string" || typeof raw.insight !== "string" || typeof raw.sql !== "string") continue
    const sql = raw.sql.trim()
    if (!validateSQL(sql).valid) continue
    const chart = parseChartMapping(raw.chart, sql)
    if (!chart) continue
    items.push({ title: raw.title.slice(0, 80), insight: raw.insight.slice(0, 1000), sql, chart })
  }
  return items
}

export function parseChartMapping(raw: unknown, sql: string): ChartMapping | null {
  if (!isRecord(raw) || typeof raw.type !== "string" || !isChartType(raw.type) || !isRecord(raw.mapping)) return null
  const contract = CHART_CONTRACTS[raw.type]
  const aliases = extractOutputAliases(sql)
  const mapping = raw.mapping

  for (const slot of contract.required) {
    if (typeof mapping[slot] !== "string" || !mapping[slot]) return null
  }
  for (const [slot, value] of Object.entries(mapping)) {
    if (![...contract.required, ...contract.optional].includes(slot)) return null
    if (COLUMN_SLOTS.has(slot) && (typeof value !== "string" || !aliases.has(value))) return null
  }

  switch (raw.type) {
    case "table": return { chartType: "table" }
    case "line": return { chartType: "line", x: stringValue(mapping.x), y: stringValue(mapping.y), color: optionalString(mapping.color) }
    case "bar": return { chartType: "bar", x: stringValue(mapping.x), y: stringValue(mapping.y), fill: optionalString(mapping.fill), mode: isBarMode(mapping.mode) ? mapping.mode : "grouped" }
    case "pie": return { chartType: "pie", name: stringValue(mapping.name), value: stringValue(mapping.value) }
    case "scatter": return { chartType: "scatter", x: stringValue(mapping.x), y: stringValue(mapping.y), color: optionalString(mapping.color) }
    case "boxplot": return { chartType: "boxplot", category: stringValue(mapping.category), value: stringValue(mapping.value) }
    case "heatmap": return { chartType: "heatmap", x: stringValue(mapping.x), y: stringValue(mapping.y), value: stringValue(mapping.value) }
    case "kpi": return { chartType: "kpi", value: stringValue(mapping.value), label: optionalString(mapping.label), comparison: optionalString(mapping.comparison) }
    case "histogram": return { chartType: "histogram", value: stringValue(mapping.value), color: optionalString(mapping.color) }
    case "correlation": {
      const columns = Array.isArray(mapping.columns) ? mapping.columns.filter((value): value is string => typeof value === "string" && aliases.has(value)).slice(0, 20) : undefined
      const method = isCorrelationMethod(mapping.method) ? mapping.method : "pearson"
      return { chartType: "correlation", columns, method }
    }
  }
}

function extractOutputAliases(sql: string): Set<string> {
  const aliases = new Set<string>()
  for (const match of sql.matchAll(/\bAS\s+"?([a-z_][\w$]*)"?/gi)) aliases.add(match[1])
  return aliases
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function isChartType(value: string): value is ChartType { return CHART_TYPES.includes(value as ChartType) }
function isCorrelationMethod(value: unknown): value is CorrelationMethod { return value === "pearson" || value === "spearman" || value === "kendall" }
function isBarMode(value: unknown): value is "grouped" | "stacked" | "normalized" { return value === "grouped" || value === "stacked" || value === "normalized" }
function stringValue(value: unknown): string { return typeof value === "string" ? value : "" }
function optionalString(value: unknown): string | undefined { return typeof value === "string" && value ? value : undefined }
