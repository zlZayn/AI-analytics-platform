import type { ChartMapping, ChartType, CorrelationMethod } from "@/components/charts/types"
import type { DisplayConfig, Filter, Join, Measure, QuerySpec, SortSpec } from "@/types/session"
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

const MEASURE_AGGREGATIONS: ReadonlySet<string> = new Set([
  "count", "sum", "avg", "min", "max", "count_distinct",
])
const FILTER_OPERATORS: ReadonlySet<string> = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "between", "is_null", "is_not_null",
])

export interface InsightContext {
  /** 来源文档/规则名称（如 RAG 检索的业务口径来源） */
  source: string
  /** 业务规则/口径描述（如「高价值客户 = 年消费 > 10 万」） */
  rule: string
  /** 是否已应用到本次 SQL/querySpec */
  applied: boolean
}

export interface InsightItem {
  title: string
  insight: string
  /** 过渡期回退：querySpec 缺失时 AI 直出的 SQL（阶段三后应逐步移除） */
  sql?: string
  /** 旧客户端兼容：ChartMapping（由 displayConfig 或旧 chart 解析） */
  chart: ChartMapping
  /** 新契约：结构化查询（阶段三起 AI 输出，compileQuerySpec 消费） */
  querySpec?: QuerySpec
  /** 新契约：呈现配置 */
  displayConfig?: DisplayConfig
  /** 回退标记：true 表示 querySpec 缺失、以 sql 直通 */
  fallback: boolean
  /** 业务上下文引用（RAG/业务口径融合预留）：AI 遵守了哪些规则 */
  context?: InsightContext[]
}

// 每个图表类型的 mapping 结构（用于 displayConfig.mapping 与旧 chart.mapping）
// OpenAI strict 模式要求 required 覆盖 properties 全部键，故把可选槽位也一并纳入 required；
// 解析端（parseMapping）对缺失/空值做容错，不影响可选语义。
const mappingSchemas = CHART_TYPES.map((type) => {
  const contract = CHART_CONTRACTS[type]
  const slots = [...contract.required, ...contract.optional]
  const properties: Record<string, unknown> = {}
  for (const slot of slots) {
    properties[slot] = { type: "string" }
  }
  if (type === "correlation") {
    properties.columns = { type: "array", items: { type: "string" } }
    properties.method = { type: "string", enum: ["pearson", "spearman", "kendall"] }
  }
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  }
})

// 旧格式：chart = { type, mapping }
const chartSchemaVariants = CHART_TYPES.map((type, i) => ({
  type: "object",
  additionalProperties: false,
  required: ["type", "mapping"],
  properties: {
    type: { type: "string", const: type },
    mapping: mappingSchemas[i],
  },
}))

const contextSchema = {
  type: "array",
  maxItems: 5,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["source", "rule", "applied"],
    properties: {
      source: { type: "string", maxLength: 120 },
      rule: { type: "string", maxLength: 300 },
      applied: { type: "boolean" },
    },
  },
} as const

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
          anyOf: [
            // 新格式（优先）：结构化查询 + 呈现配置，sql 可省略
            {
              type: "object",
              additionalProperties: false,
              required: ["title", "insight", "querySpec", "displayConfig", "context"],
              properties: {
                title: { type: "string", maxLength: 80 },
                insight: { type: "string", maxLength: 1000 },
                querySpec: { type: "object", additionalProperties: true },
                displayConfig: {
                  type: "object",
                  additionalProperties: false,
                  required: ["chartType", "mapping"],
                  properties: {
                    chartType: { type: "string", enum: CHART_TYPES },
                    mapping: { anyOf: mappingSchemas },
                  },
                },
                context: contextSchema,
              },
            },
            // 旧格式回退（过渡期）：AI 直出 SQL + chart
            {
              type: "object",
              additionalProperties: false,
              required: ["title", "insight", "sql", "chart", "context"],
              properties: {
                title: { type: "string", maxLength: 80 },
                insight: { type: "string", maxLength: 1000 },
                sql: { type: "string" },
                chart: { anyOf: chartSchemaVariants },
                context: contextSchema,
              },
            },
          ],
        },
      },
    },
  },
} as const

export function buildSystemPrompt(schemaContext: string, dataProfileText = "", businessContext = ""): string {
  const chartRules = CHART_TYPES.map((type) => {
    const contract = CHART_CONTRACTS[type]
    const slots = [...contract.required, ...contract.optional]
    return `- ${type}: ${contract.description}; mapping=${slots.length ? slots.join(", ") : "{}"}`
  }).join("\n")

  const businessSection = businessContext.trim()
    ? `\n业务口径（企业上下文，可信规则；SQL 的条件/过滤与字段解释必须遵守，不得虚构或改写；若某条规则不适用于当前问题则忽略并在 context 中不引用）：\n${businessContext.trim()}`
    : ""

  return `你是数据分析工作台的 SQL 与图表建议助手。只依据下方当前连接 Schema 回答，不得假设行业、表、列或关系。

输出契约（新格式，优先）：
- 每个洞察项必须包含 querySpec（结构化查询）与 displayConfig（呈现配置）。
- querySpec 结构：{ "table": "表名", "dimensions": ["列名"], "measures": [{ "field": "列名", "aggregation": "sum|count|avg|min|max|count_distinct", "alias": "输出别名" }], "filters": [{ "field": "列名", "op": "eq|gt|...", "value": 值 }], "having": [...], "sort": [{ "field": "别名", "direction": "asc|desc" }], "limit": 数字, "joins": [{ "table": "表名", "type": "inner|left|right", "on": { "left": "a.id", "right": "b.id" } }] }
- displayConfig 结构：{ "chartType": "bar", "mapping": { "x": "类别别名", "y": "数值别名" } }，mapping 只能引用 querySpec 输出的别名。
- 尽量同时输出 sql（过渡期字段，供旧客户端回退）；若 querySpec 已完整，sql 可省略。
- context 必须输出数组（可为空 []）；应用了业务口径中的规则时逐条回传 { "source", "rule", "applied" }。
${businessSection}
设计边界：
- 业务聚合和数据整形必须在 SQL 中完成；图表不会猜测业务语义，也不会合并重复坐标。
- 图表只是建议。首次结果保持表格，用户决定是否采用建议及其映射、排序和堆叠语义。
- SQL 必须是单条 PostgreSQL SELECT/WITH，不带分号，不得写入、锁表或调用副作用操作。
- 所有图表使用的输出列必须显式 AS 为稳定别名，mapping 只能引用这些输出别名。
- 不得静默截断、采样或改写业务数据。类别过多时应在 SQL 中合理聚合，并在 insight 中说明。
- 只返回符合 JSON Schema 的对象，不输出 Markdown、代码围栏或额外文字。

图表合同：
${chartRules}
${dataProfileText ? `\n数据轮廓（辅助判断字段类型与基数）：\n${dataProfileText}` : ""}

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
    if (!isRecord(raw) || typeof raw.title !== "string" || typeof raw.insight !== "string") continue

    // 优先 querySpec + displayConfig（新契约）
    const querySpec = parseQuerySpec(raw.querySpec)
    const displayConfig = parseDisplayConfig(raw.displayConfig)
    const context = parseContext(raw.context)
    if (querySpec && displayConfig) {
      // 过渡期：AI 同时输出 sql 时一并透传，供旧客户端（InsightCard）展示
      const sql = typeof raw.sql === "string" && validateSQL(raw.sql.trim()).valid ? raw.sql.trim() : undefined
      items.push({
        title: raw.title.slice(0, 80),
        insight: raw.insight.slice(0, 1000),
        sql,
        chart: displayConfig.mapping,
        querySpec,
        displayConfig,
        fallback: false,
        context,
      })
      continue
    }

    // 回退：AI 直出 SQL（过渡期旧格式）
    if (typeof raw.sql !== "string" || !raw.sql.trim()) continue
    const sql = raw.sql.trim()
    if (!validateSQL(sql).valid) continue
    // 图表来源：旧 chart 优先；querySpec 无效但 displayConfig 有效时用其 mapping；否则丢弃该项
    const chart = parseChartMapping(raw.chart, sql) ?? (displayConfig ? displayConfig.mapping : null)
    if (!chart) continue
    items.push({
      title: raw.title.slice(0, 80),
      insight: raw.insight.slice(0, 1000),
      sql,
      chart,
      displayConfig: displayConfig ?? undefined,
      fallback: true,
      context,
    })
  }
  return items
}

export function parseChartMapping(raw: unknown, sql: string): ChartMapping | null {
  if (!isRecord(raw) || typeof raw.type !== "string" || !isChartType(raw.type) || !isRecord(raw.mapping)) return null
  return parseMapping(raw.type, raw.mapping, extractOutputAliases(sql))
}

// 解析新契约 displayConfig：{ chartType, mapping }，无 SQL 别名校验（querySpec 路径）
function parseDisplayConfig(raw: unknown): DisplayConfig | null {
  if (!isRecord(raw) || !isChartTypeValue(raw.chartType) || !isRecord(raw.mapping)) return null
  const mapping = parseMapping(raw.chartType, raw.mapping, null)
  if (!mapping) return null
  return raw.showLegend === true
    ? { chartType: raw.chartType, mapping, showLegend: true }
    : { chartType: raw.chartType, mapping }
}

function parseMapping(
  chartType: ChartType,
  mapping: Record<string, unknown>,
  aliases: Set<string> | null,
): ChartMapping | null {
  const contract = CHART_CONTRACTS[chartType]
  const validSlots = new Set([...contract.required, ...contract.optional, "columns", "method"])

  for (const slot of contract.required) {
    if (typeof mapping[slot] !== "string" || !mapping[slot]) return null
  }
  for (const [slot, value] of Object.entries(mapping)) {
    if (!validSlots.has(slot)) return null
    // 列槽位必须引用有效输出别名（querySpec 路径传 null 跳过别名校验）
    if (COLUMN_SLOTS.has(slot) && (typeof value !== "string" || (aliases !== null && !aliases.has(value)))) return null
  }

  switch (chartType) {
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
      const columns = Array.isArray(mapping.columns) ? mapping.columns.filter((value): value is string => typeof value === "string" && (aliases === null || aliases.has(value))).slice(0, 20) : undefined
      const method = isCorrelationMethod(mapping.method) ? mapping.method : "pearson"
      return { chartType: "correlation", columns, method }
    }
  }
}

// 解析结构化查询（结构宽松校验；编译错误由 querySpec→compile 管线在运行时暴露）
function parseQuerySpec(raw: unknown): QuerySpec | null {
  if (!isRecord(raw) || typeof raw.table !== "string" || !raw.table.trim()) return null
  const spec: QuerySpec = { table: raw.table.trim() }

  if (Array.isArray(raw.dimensions)) {
    const dimensions = raw.dimensions.filter((d): d is string => typeof d === "string" && d.length > 0)
    if (dimensions.length > 0) spec.dimensions = dimensions
  }
  if (Array.isArray(raw.measures)) {
    const measures = raw.measures
      .filter((m): m is Record<string, unknown> => isRecord(m) && typeof m.field === "string" && typeof m.aggregation === "string" && MEASURE_AGGREGATIONS.has(m.aggregation))
      .map((m) => ({
        field: m.field as string,
        aggregation: m.aggregation as Measure["aggregation"],
        alias: typeof m.alias === "string" ? m.alias : undefined,
      }))
    if (measures.length > 0) spec.measures = measures
  }
  if (Array.isArray(raw.filters)) {
    const filters = raw.filters
      .filter((f): f is Record<string, unknown> => isRecord(f) && typeof f.field === "string" && typeof f.op === "string" && FILTER_OPERATORS.has(f.op))
      .map((f) => ({
        field: f.field as string,
        op: f.op as Filter["op"],
        value: f.value,
        values: Array.isArray(f.values) ? f.values : undefined,
      }))
    if (filters.length > 0) spec.filters = filters
  }
  if (Array.isArray(raw.having)) {
    const having = raw.having
      .filter((f): f is Record<string, unknown> => isRecord(f) && typeof f.field === "string" && typeof f.op === "string" && FILTER_OPERATORS.has(f.op))
      .map((f) => ({
        field: f.field as string,
        op: f.op as Filter["op"],
        value: f.value,
        values: Array.isArray(f.values) ? f.values : undefined,
      }))
    if (having.length > 0) spec.having = having
  }
  if (Array.isArray(raw.sort)) {
    const sort = raw.sort
      .filter((s): s is Record<string, unknown> => isRecord(s) && typeof s.field === "string" && (s.direction === "asc" || s.direction === "desc"))
      .map((s) => ({ field: s.field as string, direction: s.direction as SortSpec["direction"] }))
    if (sort.length > 0) spec.sort = sort
  }
  if (typeof raw.limit === "number" && raw.limit > 0 && Number.isFinite(raw.limit)) {
    spec.limit = Math.floor(raw.limit)
  }
  if (Array.isArray(raw.joins)) {
    const joins = raw.joins
      .filter(
        (j): j is Record<string, unknown> =>
          isRecord(j) &&
          typeof j.table === "string" &&
          (j.type === "inner" || j.type === "left" || j.type === "right") &&
          isRecord(j.on) &&
          typeof j.on.left === "string" &&
          typeof j.on.right === "string",
      )
      .map((j) => {
        const on = j.on as { left: string; right: string }
        return {
          table: j.table as string,
          type: j.type as Join["type"],
          on: { left: on.left, right: on.right },
        }
      })
    if (joins.length > 0) spec.joins = joins
  }
  return spec
}

function extractOutputAliases(sql: string): Set<string> {
  const aliases = new Set<string>()
  for (const match of sql.matchAll(/\bAS\s+"?([a-z_][\w$]*)"?/gi)) aliases.add(match[1])
  return aliases
}

// 解析业务上下文引用（容错：非法项丢弃；缺失返回空数组）
function parseContext(raw: unknown): InsightContext[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const contexts: InsightContext[] = []
  for (const item of raw.slice(0, 5)) {
    if (
      isRecord(item) &&
      typeof item.source === "string" &&
      item.source.trim() &&
      typeof item.rule === "string" &&
      item.rule.trim() &&
      typeof item.applied === "boolean"
    ) {
      contexts.push({ source: item.source.slice(0, 120), rule: item.rule.slice(0, 300), applied: item.applied })
    }
  }
  return contexts.length > 0 ? contexts : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function isChartType(value: string): value is ChartType { return CHART_TYPES.includes(value as ChartType) }
function isChartTypeValue(value: unknown): value is ChartType { return typeof value === "string" && isChartType(value) }
function isCorrelationMethod(value: unknown): value is CorrelationMethod { return value === "pearson" || value === "spearman" || value === "kendall" }
function isBarMode(value: unknown): value is "grouped" | "stacked" | "normalized" { return value === "grouped" || value === "stacked" || value === "normalized" }
function stringValue(value: unknown): string { return typeof value === "string" ? value : "" }
function optionalString(value: unknown): string | undefined { return typeof value === "string" && value ? value : undefined }
