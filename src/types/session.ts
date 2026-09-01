// 重构核心类型定义（阶段一）
// 状态是唯一的真相，视图是状态的函数，操作是状态的转换。

import type { ChartMapping } from "@/components/charts/types"
import type { ChartType } from "@/lib/variable-types"

// ---- 语义类型（与 components/charts/pipeline.ts 保持一致，并扩展） ----

export type SemanticType =
  | "numeric"
  | "temporal"
  | "categorical"
  | "boolean"
  | "identifier"
  | "text"
  | "unknown"

// ---- 查询规范（QuerySpec） ----

export interface Measure {
  field: string
  aggregation: "count" | "sum" | "avg" | "min" | "max" | "count_distinct"
  alias?: string
}

/**
 * 表达式：用于维度中无法用单一列表达的场景
 * - date_trunc: 截断时间（part 如 day/month/year）
 * - extract: 提取时间部分（part 如 year/month/dow）
 * - concat: 拼接多个字段或字面量
 */
export interface Expression {
  kind: "date_trunc" | "extract" | "concat"
  field?: string
  part?: string
  items?: Array<string | Expression>
}

export type Dimension = string | Expression

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "between"
  | "is_null"
  | "is_not_null"

export interface Filter {
  field: string
  op: FilterOperator
  value?: unknown
  values?: unknown[]
}

export interface Join {
  table: string
  type: "inner" | "left" | "right"
  on: { left: string; right: string }
}

export interface SortSpec {
  field: string
  direction: "asc" | "desc"
}

export interface QuerySpec {
  table: string
  dimensions?: Dimension[]
  measures?: Measure[]
  filters?: Filter[]
  having?: Filter[]
  sort?: SortSpec[]
  limit?: number
  joins?: Join[]
}

// ---- 编译结果 ----

/** 参数化编译结果：sql 中占位符为 $1/$2/...，params 为对应值 */
export interface CompiledSql {
  sql: string
  params: unknown[]
}

// ---- 语义数据集（扩展现有 QueryResult） ----

export interface SemanticColumn {
  name: string
  type: string
  semanticType: SemanticType
}

export interface SemanticDataset {
  columns: SemanticColumn[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
  returnedRowCount: number
  truncated: boolean
  rowLimit: number
}

// ---- 呈现配置（复用 ChartMapping + ChartType） ----

export interface DisplayConfig {
  chartType: ChartType
  mapping: ChartMapping
  showLegend?: boolean
  mode?: "grouped" | "stacked" | "normalized"
}

// ---- 会话状态 ----

export type SessionStatus =
  | "idle"
  | "compiling"
  | "executing"
  | "ready"
  | "error"
  | "needs_recompile"

export interface ConversationMessage {
  role: "user" | "assistant"
  content: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

/** 核心状态容器：唯一真相 */
export interface AnalysisSession {
  id: string
  question: string
  title: string
  insight: string
  querySpec: QuerySpec
  compiledSql: CompiledSql | null
  result: SemanticDataset | null
  displayConfig: DisplayConfig
  status: SessionStatus
  error?: string
  source: "ai" | "user"
  isUserModified: boolean
  conversationHistory: ConversationMessage[]
  createdAt: Date
  updatedAt: Date
}
