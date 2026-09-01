// QuerySpec → 参数化 SQL 编译器（阶段一）
// 防注入设计：
// - 所有 filter.value 通过 params 数组传递，SQL 中用 $N 占位符
// - 标识符（表名、列名、别名）用双引号包裹，内部双引号转义为 ""
// - SQL 关键字（如 DATE_TRUNC 的 precision）用单引号包裹，内部单引号转义为 ''
// - limit 用 Number() 转换后直接拼接（数字类型无注入风险）

import type {
  CompiledSql,
  Dimension,
  Expression,
  Filter,
  Measure,
  QuerySpec,
} from "@/types/session"
import type { SchemaData } from "@/types"

// ---- 标识符与字面量安全拼接 ----

function quoteIdent(name: string): string {
  // 支持 table.column 形式的限定名，逐段加双引号（如 "orders"."customer_id"）
  if (name.includes(".")) {
    return name
      .split(".")
      .map((part) => `"${part.replace(/"/g, '""')}"`)
      .join(".")
  }
  return `"${name.replace(/"/g, '""')}"`
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/** LIKE 通配符转义，配合 ESCAPE '\' 使用 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`)
}

// ---- 表达式渲染 ----

function renderExpression(expr: Expression, index: number): { sql: string; alias: string } {
  if (expr.kind === "date_trunc") {
    if (!expr.field) throw new Error(`date_trunc 表达式缺少 field（索引 ${index}）`)
    if (!expr.part) throw new Error(`date_trunc 表达式缺少 part（索引 ${index}）`)
    return {
      sql: `date_trunc(${quoteLiteral(expr.part)}, ${quoteIdent(expr.field)})`,
      alias: `expr_${index}`,
    }
  }
  if (expr.kind === "extract") {
    if (!expr.field) throw new Error(`extract 表达式缺少 field（索引 ${index}）`)
    if (!expr.part) throw new Error(`extract 表达式缺少 part（索引 ${index}）`)
    return {
      sql: `extract(${expr.part} from ${quoteIdent(expr.field)})`,
      alias: `expr_${index}`,
    }
  }
  if (expr.kind === "concat") {
    const items = expr.items ?? []
    if (items.length === 0) throw new Error(`concat 表达式缺少 items（索引 ${index}）`)
    const parts = items.map((item, i) =>
      typeof item === "string"
        ? /^[A-Za-z_][A-Za-z0-9_]*$/.test(item)
          ? quoteIdent(item)
          : quoteLiteral(item)
        : renderExpression(item, i).sql,
    )
    return { sql: `concat(${parts.join(", ")})`, alias: `expr_${index}` }
  }
  throw new Error(`未知表达式类型: ${(expr as Expression).kind}`)
}

function renderDimension(dim: Dimension, index: number): string {
  if (typeof dim === "string") {
    return quoteIdent(dim)
  }
  return renderExpression(dim, index).sql
}

function renderMeasure(measure: Measure): string {
  const field = quoteIdent(measure.field)
  let sql: string
  switch (measure.aggregation) {
    case "count":
      sql = `count(*)`
      break
    case "count_distinct":
      sql = `count(DISTINCT ${field})`
      break
    case "sum":
      sql = `sum(${field})`
      break
    case "avg":
      sql = `avg(${field})`
      break
    case "min":
      sql = `min(${field})`
      break
    case "max":
      sql = `max(${field})`
      break
    default:
      throw new Error(`未知聚合: ${(measure as Measure).aggregation}`)
  }
  const alias = measure.alias ?? `${measure.aggregation}_${measure.field}`
  return `${sql} AS ${quoteIdent(alias)}`
}

// ---- 过滤条件渲染（参数化） ----

function renderFilter(filter: Filter, params: unknown[], having: boolean): string {
  const field = quoteIdent(filter.field)
  const push = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }
  switch (filter.op) {
    case "eq":
      return `${field} = ${push(filter.value)}`
    case "neq":
      return `${field} <> ${push(filter.value)}`
    case "gt":
      return `${field} > ${push(filter.value)}`
    case "gte":
      return `${field} >= ${push(filter.value)}`
    case "lt":
      return `${field} < ${push(filter.value)}`
    case "lte":
      return `${field} <= ${push(filter.value)}`
    case "in": {
      const values = filter.values ?? []
      if (values.length === 0) throw new Error(`IN 过滤需要至少一个值（${filter.field}）`)
      const placeholders = values.map(push).join(", ")
      return `${field} IN (${placeholders})`
    }
    case "not_in": {
      const values = filter.values ?? []
      if (values.length === 0) throw new Error(`NOT IN 过滤需要至少一个值（${filter.field}）`)
      const placeholders = values.map(push).join(", ")
      return `${field} NOT IN (${placeholders})`
    }
    case "contains":
      return `${field}::text ILIKE ${push(`%${escapeLike(String(filter.value ?? ""))}%`)} ESCAPE '\\'`
    case "between": {
      const values = filter.values ?? []
      if (values.length < 2) throw new Error(`BETWEEN 过滤需要两个值（${filter.field}）`)
      return `${field} BETWEEN ${push(values[0])} AND ${push(values[1])}`
    }
    case "is_null":
      return `${field} IS NULL`
    case "is_not_null":
      return `${field} IS NOT NULL`
    default:
      throw new Error(`未知过滤操作符: ${(filter as Filter).op}${having ? "（HAVING）" : ""}`)
  }
}

// ---- Schema 校验（可选，防止 AI 生成不存在的字段） ----

function validateAgainstSchema(querySpec: QuerySpec, schema: SchemaData): void {
  const table = schema.tables.find((t) => t.name === querySpec.table)
  if (!table) {
    throw new Error(`表不存在: ${querySpec.table}`)
  }
  const columnNames = new Set(table.columns.map((c) => c.name))

  const checkDimension = (dim: Dimension) => {
    if (typeof dim === "string") {
      if (!columnNames.has(dim)) throw new Error(`列不存在: ${querySpec.table}.${dim}`)
    } else if (dim.field && !columnNames.has(dim.field)) {
      throw new Error(`列不存在: ${querySpec.table}.${dim.field}`)
    }
  }
  const checkColumn = (field: string) => {
    if (!columnNames.has(field)) throw new Error(`列不存在: ${querySpec.table}.${field}`)
  }

  ;(querySpec.dimensions ?? []).forEach(checkDimension)
  ;(querySpec.measures ?? []).forEach((m) => checkColumn(m.field))
  ;(querySpec.filters ?? []).forEach((f) => checkColumn(f.field))
  ;(querySpec.joins ?? []).forEach((join) => {
    if (!schema.tables.some((t) => t.name === join.table)) {
      throw new Error(`连接表不存在: ${join.table}`)
    }
  })
  // having 引用聚合别名或维度，不在此处校验
}

// ---- 编译入口 ----

/**
 * 将 QuerySpec 编译为参数化 SQL。
 * @param querySpec 查询规范
 * @param schema 可选的 SchemaData；提供时会对表/列做存在性校验，抛出 Error
 * @returns { sql, params }
 */
export function compileQuerySpec(querySpec: QuerySpec, schema?: SchemaData): CompiledSql {
  if (!querySpec.table) {
    throw new Error("QuerySpec 缺少 table")
  }
  if (schema) {
    validateAgainstSchema(querySpec, schema)
  }

  const params: unknown[] = []
  const dimensions = querySpec.dimensions ?? []
  const measures = querySpec.measures ?? []

  // SELECT
  const selectParts: string[] = []
  dimensions.forEach((dim, i) => {
    const dimSql = renderDimension(dim, i)
    // 表达式维度需要别名，保证输出列名可预测（expr_0 / expr_1 ...）
    const alias = typeof dim === "string" ? null : renderExpression(dim as Expression, i).alias
    selectParts.push(alias ? `${dimSql} AS ${quoteIdent(alias)}` : dimSql)
  })
  measures.forEach((measure) => selectParts.push(renderMeasure(measure)))

  if (selectParts.length === 0) {
    throw new Error("QuerySpec 至少需要 dimensions 或 measures")
  }

  // FROM + JOIN
  let sql = `SELECT ${selectParts.join(", ")} FROM ${quoteIdent(querySpec.table)}`
  ;(querySpec.joins ?? []).forEach((join) => {
    sql += ` ${join.type.toUpperCase()} JOIN ${quoteIdent(join.table)} ON ${quoteIdent(join.on.left)} = ${quoteIdent(join.on.right)}`
  })

  // WHERE
  const filters = querySpec.filters ?? []
  if (filters.length > 0) {
    sql += ` WHERE ${filters.map((f) => renderFilter(f, params, false)).join(" AND ")}`
  }

  // GROUP BY（按 SELECT 中的维度表达式）
  if (dimensions.length > 0) {
    const groupParts = dimensions.map((dim, i) => renderDimension(dim, i))
    sql += ` GROUP BY ${groupParts.join(", ")}`
  }

  // HAVING
  const having = querySpec.having ?? []
  if (having.length > 0) {
    sql += ` HAVING ${having.map((f) => renderFilter(f, params, true)).join(" AND ")}`
  }

  // ORDER BY（引用输出列名或别名）
  const sort = querySpec.sort ?? []
  if (sort.length > 0) {
    sql += ` ORDER BY ${sort
      .map((s) => `${quoteIdent(s.field)} ${s.direction === "desc" ? "DESC" : "ASC"}`)
      .join(", ")}`
  }

  // LIMIT
  if (querySpec.limit !== undefined) {
    const limit = Number(querySpec.limit)
    if (!Number.isFinite(limit) || limit < 0) {
      throw new Error(`非法的 limit: ${querySpec.limit}`)
    }
    sql += ` LIMIT ${Math.floor(limit)}`
  }

  return { sql, params }
}
