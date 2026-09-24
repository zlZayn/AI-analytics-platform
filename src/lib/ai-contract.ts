import type { ChartMapping, ChartType } from "@/components/charts/types"
import type { DisplayConfig, QuerySpec } from "@/types/session"
import type { StatTestRequest } from "@/lib/r-stats"

interface ChartContract {
  required: readonly string[]
  optional: readonly string[]
  description: string
}

export const CHART_CONTRACTS = {
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
} as const satisfies Record<ChartType, ChartContract>

export const CHART_TYPES = Object.keys(CHART_CONTRACTS) as ChartType[]
export const COLUMN_SLOTS = new Set(["x", "y", "color", "fill", "name", "value", "category", "label", "comparison"])

export const MEASURE_AGGREGATIONS: ReadonlySet<string> = new Set([
  "count", "sum", "avg", "min", "max", "count_distinct",
])
export const FILTER_OPERATORS: ReadonlySet<string> = new Set([
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
  sql?: string | undefined
  /** sql 是否通过只读预检；false = 仅可复制，不能一键执行 */
  sqlValid?: boolean | undefined
  /** 降级说明：渲染失败或不可执行的原因（无则未降级） */
  notice?: string | undefined
  /** 旧客户端兼容：ChartMapping（由 displayConfig 或旧 chart 解析） */
  chart: ChartMapping
  /** 新契约：结构化查询（阶段三起 AI 输出，compileQuerySpec 消费） */
  querySpec?: QuerySpec | undefined
  /** 新契约：呈现配置 */
  displayConfig?: DisplayConfig | undefined
  /** 回退标记：true 表示 querySpec 缺失、以 sql 直通 */
  fallback: boolean
  /** 业务上下文引用（RAG/业务口径融合预留）：AI 遵守了哪些规则 */
  context?: InsightContext[] | undefined
  /** 显著性检验建议（蓝图阶段 3 黑盒统计：前端用固定模板在 WebR 执行，AI 不写 R） */
  statTest?: StatTestRequest | undefined
}

/** 契约上限总表：schema 与解析层都从这里读，数值只写一次。
 *  改这里即同时改到提示词 schema 与两条解析分支的截断，不会再单侧漂移。 */
export const LIMITS = {
  title: 80,
  insight: 1000,
  contextSource: 120,
  contextRule: 300,
  contextItems: 5,
  hypothesis: 200,
  /** 仅解析侧截断：schema 对 correlation.columns 未声明 maxItems（收紧对模型的约束属行为变更，另计） */
  correlationColumns: 20,
} as const

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
  maxItems: LIMITS.contextItems,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["source", "rule", "applied"],
    properties: {
      source: { type: "string", maxLength: LIMITS.contextSource },
      rule: { type: "string", maxLength: LIMITS.contextRule },
      applied: { type: "boolean" },
    },
  },
} as const

// 显著性检验建议（黑盒统计：仅当业务问题需要假设检验/相关性推断时输出，否则 null）
const statTestSchema = {
  type: ["object", "null"],
  additionalProperties: false,
  required: ["kind", "x", "y", "hypothesis"],
  properties: {
    kind: { type: "string", enum: ["ttest", "cor", "chisq"] },
    x: { type: "string" },
    y: { type: "string" },
    hypothesis: { type: "string", maxLength: LIMITS.hypothesis },
  },
} as const

/**
 * 洞察项契约的单一来源：提示词、strict JSON Schema、解析截断长度都从这里派生，改一处三面同步。
 * - variants：字段属于哪个输出变体（querySpec = 优先；sql = 过渡回退）
 * - example：生成提示词形状示例用
 * - maxLength：与 schema 一致，解析时按它截断
 */
export type InsightVariant = "querySpec" | "sql"

export const MAX_INSIGHT_ITEMS = 6

interface InsightFieldSpec {
  variants: readonly InsightVariant[]
  schema: Record<string, unknown>
  example: string
  maxLength?: number
  prompt?: string
  details?: readonly string[]
}

export const INSIGHT_FIELDS = {
  title: {
    variants: ["querySpec", "sql"],
    schema: { type: "string", maxLength: LIMITS.title },
    example: '"短标题"',
    maxLength: LIMITS.title,
    prompt: "短标题",
  },
  insight: {
    variants: ["querySpec", "sql"],
    schema: { type: "string", maxLength: LIMITS.insight },
    example: '"业务语言结论"',
    maxLength: LIMITS.insight,
    prompt: "业务语言结论",
  },
  querySpec: {
    variants: ["querySpec"],
    schema: { type: "object", additionalProperties: true },
    example: "{...}",
    prompt: "结构化查询（优先变体必填）",
    details: [
      'querySpec 结构：{ "table": "表名", "dimensions": ["列名"], "measures": [{ "field": "列名", "aggregation": "sum|count|avg|min|max|count_distinct", "alias": "输出别名" }], "filters": [{ "field": "列名", "op": "eq|gt|...", "value": 值 }], "having": [...], "sort": [{ "field": "别名", "direction": "asc|desc" }], "limit": 数字, "joins": [{ "table": "表名", "type": "inner|left|right", "on": { "left": "a.id", "right": "b.id" } }] }',
    ],
  },
  displayConfig: {
    variants: ["querySpec"],
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["chartType", "mapping"],
      properties: {
        chartType: { type: "string", enum: CHART_TYPES },
        mapping: { anyOf: mappingSchemas },
      },
    },
    example: "{...}",
    prompt: "呈现配置（chartType + mapping）",
    details: [
      'displayConfig 结构：{ "chartType": "bar", "mapping": { "x": "类别别名", "y": "数值别名" } }，mapping 只能引用 querySpec 输出的别名。',
    ],
  },
  sql: {
    variants: ["sql"],
    schema: { type: "string" },
    example: '"SELECT ..."',
    prompt: "单条只读 SQL（回退变体必填；优先变体不要输出，schema 会拒绝）",
  },
  chart: {
    variants: ["sql"],
    schema: { anyOf: chartSchemaVariants },
    example: "{...}",
    prompt: "图表建议（回退变体必填）",
    details: ["chart 的 mapping 列必须引用 SQL 中显式 AS 的输出别名。"],
  },
  context: {
    variants: ["querySpec", "sql"],
    schema: contextSchema,
    example: "[]",
    prompt: "业务口径引用数组（无引用时输出空数组）",
    details: ['应用了业务口径中的规则时逐条回传 { "source", "rule", "applied" }。'],
  },
  statTest: {
    variants: ["querySpec", "sql"],
    schema: statTestSchema,
    example: "null",
    prompt: "显著性检验建议（多数情况为 null）",
    details: [
      "当问题需要比较两组数值是否显著不同（ttest）、检验两数值列相关（cor）或检验类别分布关联（chisq）时输出 { kind, x, y, hypothesis }（x/y 引用 querySpec 输出别名）；其余情况 null。统计检验由平台在本地固定模板执行，你无需编写 R 代码。",
    ],
  },
} as const satisfies Record<string, InsightFieldSpec>

const VARIANT_ORDER: InsightVariant[] = ["querySpec", "sql"]

function fieldsOf(variant: InsightVariant): [string, InsightFieldSpec][] {
  return Object.entries(INSIGHT_FIELDS).filter(([, spec]) =>
    (spec.variants as readonly InsightVariant[]).includes(variant),
  )
}

/** strict 模式要求 required 覆盖 properties 全部键，故按变体成员一次性生成 */
function buildVariantSchema(variant: InsightVariant) {
  const fields = fieldsOf(variant)
  return {
    type: "object",
    additionalProperties: false,
    required: fields.map(([name]) => name),
    properties: Object.fromEntries(fields.map(([name, spec]) => [name, spec.schema])),
  }
}

/** 提示词里的输出契约段：形状示例、字段说明、变体成员、条数上限都来自同一份声明 */
function buildContractSection(): string {
  const shape = (variant: InsightVariant) =>
    `{ "items": [ { ${fieldsOf(variant).map(([name, spec]) => `"${name}": ${spec.example}`).join(", ")} } ] }`
  return [
    `- 根对象形状（优先变体）：${shape("querySpec")}`,
    `- 根对象形状（回退变体，仅当无法给出 querySpec 时使用）：${shape("sql")}`,
    `- 最多 ${MAX_INSIGHT_ITEMS} 项，不要返回裸数组；字段名固定，不要自造（如 description/id）。`,
    ...(Object.entries(INSIGHT_FIELDS) as [string, InsightFieldSpec][]).flatMap(([name, spec]) => [
      ...(spec.prompt ? [`- ${name}：${spec.prompt}`] : []),
      ...(spec.details ?? []),
    ]),
    // 只输出 JSON：既约束模型，也满足网关 json_object 模式要求提示词含「json」字样的前置条件
    "- 只返回符合 JSON Schema 的对象：不输出 Markdown、代码围栏、解释性文字或对话式回答。",
    // 输出预算纪律：推理模型会把预算花在推理上，长结论容易把 JSON 砍在半句（被截断 = 整轮作废）
    "- 宁可少而完整：一次最多 3 条，每条 insight 不超过 200 字；问题较宽时先给最有价值的 2-3 条，不要为凑数量写长结论。",
  ].join("\n")
}

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
        maxItems: MAX_INSIGHT_ITEMS,
        items: { anyOf: VARIANT_ORDER.map(buildVariantSchema) },
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

输出契约：
${buildContractSection()}
${businessSection}
设计边界：
- 业务聚合和数据整形必须在 SQL 中完成；图表不会猜测业务语义，也不会合并重复坐标。
- 图表只是建议。首次结果保持表格，用户决定是否采用建议及其映射、排序和堆叠语义。
- SQL 必须是单条 PostgreSQL SELECT/WITH，不带分号，不得写入、锁表或调用副作用操作。
- 所有图表使用的输出列必须显式 AS 为稳定别名，mapping 只能引用这些输出别名。
- 不得静默截断、采样或改写业务数据。类别过多时应在 SQL 中合理聚合，并在 insight 中说明。

图表合同：
${chartRules}
${dataProfileText ? `\n数据轮廓（辅助判断字段类型与基数）：\n${dataProfileText}` : ""}

当前连接 Schema：
${schemaContext}`
}
