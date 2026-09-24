// 契约的解析侧：把提供方返回的 JSON 变成 InsightItem（含 querySpec 优先、sql 回退两分支）。
// 字段与上限的声明仍在 ai-contract（单一来源）；本文件只读它的导出，不另立第二套。
import type { ChartMapping, ChartType, CorrelationMethod } from "@/components/charts/types"
import type { DisplayConfig, Filter, Join, Measure, QuerySpec, SortSpec } from "@/types/session"
import type { StatTestRequest } from "@/lib/r-stats"
import { validateSQL } from "./sql-validator"
import {
  CHART_CONTRACTS,
  CHART_TYPES,
  COLUMN_SLOTS,
  FILTER_OPERATORS,
  INSIGHT_FIELDS,
  LIMITS,
  MAX_INSIGHT_ITEMS,
  MEASURE_AGGREGATIONS,
  type InsightContext,
  type InsightItem,
} from "./ai-contract"

export function parseInsightItems(content: string): InsightItem[] {
  let root: unknown
  try {
    root = JSON.parse(content)
  } catch {
    return []
  }
  if (!isRecord(root) || !Array.isArray(root.items)) return []

  const items: InsightItem[] = []
  for (const raw of root.items.slice(0, MAX_INSIGHT_ITEMS)) {
    if (!isRecord(raw) || typeof raw.title !== "string" || typeof raw.insight !== "string") continue

    // SQL 保留原文：未通过只读预检的也保留（仅供复制），能否一键执行由 sqlValid 标记
    const rawSql = typeof raw.sql === "string" ? raw.sql.trim() : ""
    const sqlValid = rawSql.length > 0 ? validateSQL(rawSql).valid : false
    const notices: string[] = []
    if (rawSql && !sqlValid) notices.push("SQL 未通过只读预检，不能一键执行，可复制后自行运行")

    // 优先 querySpec + displayConfig（新契约）
    const querySpec = parseQuerySpec(raw.querySpec)
    const displayConfig = parseDisplayConfig(raw.displayConfig)
    const context = parseContext(raw.context)
    const statTest = parseStatTest(raw.statTest)
    if (querySpec && displayConfig) {
      items.push(buildQuerySpecItem({ title: raw.title, insight: raw.insight, rawSql, sqlValid, notices, context, statTest, querySpec, displayConfig }))
      continue
    }
    items.push(buildFallbackItem(raw, { title: raw.title, insight: raw.insight, rawSql, sqlValid, notices, context, statTest, displayConfig }))
  }
  return items
}

interface ParsedInsightParts {
  title: string
  insight: string
  rawSql: string
  sqlValid: boolean
  notices: string[]
  context: InsightContext[] | undefined
  statTest: StatTestRequest | undefined
}

function buildQuerySpecItem(parts: ParsedInsightParts & { querySpec: QuerySpec; displayConfig: DisplayConfig }): InsightItem {
  const { title, insight, rawSql, sqlValid, notices, context, statTest, querySpec, displayConfig } = parts
  // 过渡期：AI 同时输出 sql 时一并透传，供旧客户端（InsightCard）展示
  return {
    title: title.slice(0, INSIGHT_FIELDS.title.maxLength),
    insight: insight.slice(0, INSIGHT_FIELDS.insight.maxLength),
    sql: rawSql || undefined,
    sqlValid: rawSql ? sqlValid : undefined,
    chart: displayConfig.mapping,
    querySpec,
    displayConfig,
    fallback: false,
    context,
    statTest,
    notice: notices.length > 0 ? notices.join("；") : undefined,
  }
}

function buildFallbackItem(raw: Record<string, unknown>, parts: ParsedInsightParts & { displayConfig: DisplayConfig | null }): InsightItem {
  const { title, insight, rawSql, sqlValid, notices, context, statTest, displayConfig } = parts
  // 无 querySpec：靠 SQL 兜底；图表映射无效则回退表格——渲染失败不作为丢弃该项的理由
  let chart = parseChartMapping(raw.chart, rawSql) ?? (displayConfig ? displayConfig.mapping : null)
  if (!chart) {
    chart = { chartType: "table" }
    notices.push("图表映射无效，已回退为表格")
  }
  if (!rawSql) notices.push("AI 未给出可执行 SQL")
  return {
    title: title.slice(0, INSIGHT_FIELDS.title.maxLength),
    insight: insight.slice(0, INSIGHT_FIELDS.insight.maxLength),
    sql: rawSql || undefined,
    sqlValid: rawSql ? sqlValid : undefined,
    chart,
    displayConfig: displayConfig ?? undefined,
    fallback: true,
    context,
    statTest,
    notice: notices.length > 0 ? notices.join("；") : undefined,
  }
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
      const columns = Array.isArray(mapping.columns) ? mapping.columns.filter((value): value is string => typeof value === "string" && (aliases === null || aliases.has(value))).slice(0, LIMITS.correlationColumns) : undefined
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
  const measures = parseMeasureList(raw)
  if (measures.length > 0) spec.measures = measures
  const filters = parseFilterList(raw.filters)
  if (filters.length > 0) spec.filters = filters
  const having = parseFilterList(raw.having)
  if (having.length > 0) spec.having = having
  const sort = parseSortList(raw)
  if (sort.length > 0) spec.sort = sort
  if (typeof raw.limit === "number" && raw.limit > 0 && Number.isFinite(raw.limit)) {
    spec.limit = Math.floor(raw.limit)
  }
  const joins = parseJoinList(raw)
  if (joins.length > 0) spec.joins = joins
  return spec
}

function parseMeasureList(raw: Record<string, unknown>): Measure[] {
  if (!Array.isArray(raw.measures)) return []
  return raw.measures
    .filter((m): m is Record<string, unknown> => isRecord(m) && typeof m.field === "string" && typeof m.aggregation === "string" && MEASURE_AGGREGATIONS.has(m.aggregation))
    .map((m) => ({
      field: m.field as string,
      aggregation: m.aggregation as Measure["aggregation"],
      alias: typeof m.alias === "string" ? m.alias : undefined,
    }))
}

/** filters 与 having 同形：同一套算子白名单、同一个 Filter 契约，只解析一次 */
function parseFilterList(input: unknown): Filter[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((f): f is Record<string, unknown> => isRecord(f) && typeof f.field === "string" && typeof f.op === "string" && FILTER_OPERATORS.has(f.op))
    .map((f) => ({
      field: f.field as string,
      op: f.op as Filter["op"],
      value: f.value,
      values: Array.isArray(f.values) ? f.values : undefined,
    }))
}

function parseSortList(raw: Record<string, unknown>): SortSpec[] {
  if (!Array.isArray(raw.sort)) return []
  return raw.sort
    .filter((s): s is Record<string, unknown> => isRecord(s) && typeof s.field === "string" && (s.direction === "asc" || s.direction === "desc"))
    .map((s) => ({ field: s.field as string, direction: s.direction as SortSpec["direction"] }))
}

function parseJoinList(raw: Record<string, unknown>): Join[] {
  if (!Array.isArray(raw.joins)) return []
  return raw.joins
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
}

function extractOutputAliases(sql: string): Set<string> {
  const aliases = new Set<string>()
  for (const match of sql.matchAll(/\bAS\s+"?([a-z_][\w$]*)"?/gi)) {
    const alias = match[1]
    // 捕获组不参与就不可能整体匹配，此处必然拿到字符串
    if (alias !== undefined) aliases.add(alias)
  }
  return aliases
}

// 解析业务上下文引用（容错：非法项丢弃；缺失返回空数组）
function parseContext(raw: unknown): InsightContext[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const contexts: InsightContext[] = []
  for (const item of raw.slice(0, LIMITS.contextItems)) {
    if (
      isRecord(item) &&
      typeof item.source === "string" &&
      item.source.trim() &&
      typeof item.rule === "string" &&
      item.rule.trim() &&
      typeof item.applied === "boolean"
    ) {
      contexts.push({ source: item.source.slice(0, LIMITS.contextSource), rule: item.rule.slice(0, LIMITS.contextRule), applied: item.applied })
    }
  }
  return contexts.length > 0 ? contexts : undefined
}

// 解析显著性检验建议（容错：null/非法 → undefined）
function parseStatTest(raw: unknown): StatTestRequest | undefined {
  if (!isRecord(raw)) return undefined
  const kind = raw.kind
  if (kind !== "ttest" && kind !== "cor" && kind !== "chisq") return undefined
  if (typeof raw.x !== "string" || !raw.x || typeof raw.y !== "string" || !raw.y) return undefined
  const hypothesis = typeof raw.hypothesis === "string" && raw.hypothesis.trim() ? raw.hypothesis.slice(0, LIMITS.hypothesis) : ""
  return { kind, x: raw.x, y: raw.y, hypothesis }
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
