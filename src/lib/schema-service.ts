import { Pool } from 'pg'
import { decrypt } from './encryption'
import { prisma } from './prisma'

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimary: boolean
  comment?: string
  defaultValue?: string
}

export interface TableInfo {
  name: string
  schema: string
  comment?: string
  columns: ColumnInfo[]
  indexes: { name: string; columns: string[]; unique: boolean }[]
  rowEstimate: number
}

export interface RelationInfo {
  name: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

export interface DatabaseSchema {
  version: number
  scannedAt: Date
  tables: TableInfo[]
  relations: RelationInfo[]
}

async function getPool(connectionId: string): Promise<Pool> {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId }
  })

  if (!connection) {
    throw new Error('连接不存在')
  }

  const password = decrypt(connection.passwordEncrypted)

  return new Pool({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.username,
    password,
    ssl: connection.ssl,
    max: 5
  })
}

export async function scanSchema(connectionId: string): Promise<DatabaseSchema> {
  const pool = await getPool(connectionId)

  try {
    // 平台自身的元数据表，不展示给用户
    const PLATFORM_TABLES = [
      'users', 'connections', 'schema_snapshots', 'saved_queries', 'query_history',
      'dashboards', 'dashboard_widgets', 'analysis_templates',
      'ai_conversations', 'ai_messages', 'system_configs',
    ]

    // 获取所有表（排除平台元数据表）
    const tablesResult = await pool.query(`
      SELECT
        t.table_name,
        obj_description((quote_ident(t.table_name))::regclass) as table_comment
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_name NOT IN (${PLATFORM_TABLES.map((_, i) => `$${i + 1}`).join(',')})
      ORDER BY t.table_name
    `, PLATFORM_TABLES)

    const tables: TableInfo[] = []

    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name

      // 获取列信息
      const columnsResult = await pool.query(`
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          col_description((quote_ident(c.table_name))::regclass, c.ordinal_position) as column_comment,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_name = $1
        ORDER BY c.ordinal_position
      `, [tableName])

      // 获取索引
      const indexesResult = await pool.query(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = $1
      `, [tableName])

      // 获取行数估计
      const statsResult = await pool.query(`
        SELECT reltuples::bigint as estimate
        FROM pg_class
        WHERE relname = $1
      `, [tableName])

      tables.push({
        name: tableName,
        schema: 'public',
        comment: tableRow.table_comment,
        columns: columnsResult.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          isPrimary: col.is_primary,
          comment: col.column_comment,
          defaultValue: col.column_default
        })),
        indexes: indexesResult.rows.map(idx => ({
          name: idx.indexname,
          columns: [], // 简化处理
          unique: idx.indexdef.includes('UNIQUE')
        })),
        rowEstimate: parseInt(statsResult.rows[0]?.estimate || '0')
      })
    }

    // 获取外键关系
    const relationsResult = await pool.query(`
      SELECT
        tc.constraint_name,
        tc.table_name as from_table,
        kcu.column_name as from_column,
        ccu.table_name as to_table,
        ccu.column_name as to_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
    `)

    const relations: RelationInfo[] = relationsResult.rows.map(row => ({
      name: row.constraint_name,
      fromTable: row.from_table,
      fromColumn: row.from_column,
      toTable: row.to_table,
      toColumn: row.to_column
    }))

    return {
      version: Math.floor(Date.now() / 1000),
      scannedAt: new Date(),
      tables,
      relations
    }
  } finally {
    await pool.end()
  }
}

export function buildSchemaContext(schema: DatabaseSchema): string {
  let context = '## 数据库结构\n\n'

  context += '这是当前连接的数据库结构。只使用下方真实存在的表、列和关系，不要假设行业模型或预置业务指标。\n\n'

  // 详细表结构
  context += '### 表结构详情\n'
  schema.tables.forEach(table => {
    context += `\n#### ${table.name}\n`
    table.columns.forEach(col => {
      const parts = [col.name, col.type]
      if (col.isPrimary) parts.push('PK')
      if (!col.nullable) parts.push('NOT NULL')
      if (col.comment) parts.push(`-- ${col.comment}`)
      context += `- ${parts.join(' ')}\n`
    })
  })

  // 关系
  if (schema.relations.length > 0) {
    context += '\n### 表关系\n'
    schema.relations.forEach(rel => {
      context += `- ${rel.fromTable}.${rel.fromColumn} -> ${rel.toTable}.${rel.toColumn}\n`
    })
  }

  return context
}

// ---- 数据轮廓扫描（阶段一追加，不影响上述现有函数） ----

export interface ColumnDataProfile {
  name: string
  type: string
  distinctCount: number
  nullCount: number
  min: number | string | null
  max: number | string | null
  samples: unknown[]
}

export interface TableDataProfile {
  table: string
  rowCount: number
  columns: ColumnDataProfile[]
}

const PROFILE_NUMERIC_TYPES = /int|numeric|decimal|real|double|float|serial|money/i
const PROFILE_TEMPORAL_TYPES = /date|time|timestamp|interval/i

function profileQuoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/** 只有可排序类型才计算 min/max（boolean/json/数组等不支持 min/max 聚合） */
function supportsMinMax(type: string): boolean {
  return (
    PROFILE_NUMERIC_TYPES.test(type) ||
    PROFILE_TEMPORAL_TYPES.test(type) ||
    /char|text/i.test(type)
  )
}

/**
 * 扫描单个表的列数据轮廓：唯一值数、NULL 数、min/max、样本值。
 * 每表 3 次查询：列清单 + 聚合统计 + 样本行。
 */
export async function scanDataProfile(
  connectionId: string,
  tableName: string,
): Promise<TableDataProfile> {
  const pool = await getPool(connectionId)
  try {
    // 1. 列清单
    const colsResult = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [tableName],
    )
    const columns = colsResult.rows as { column_name: string; data_type: string }[]
    const table = profileQuoteIdent(tableName)

    // 2. 聚合统计（单查询，按列支持性计算 min/max）
    const aggregates = columns.map((col, i) => {
      const c = profileQuoteIdent(col.column_name)
      const minMax = supportsMinMax(col.data_type)
        ? `, min(${c}) AS mn_${i}, max(${c}) AS mx_${i}`
        : ''
      return `count(${c}) AS n_${i}, count(DISTINCT ${c}) AS d_${i}${minMax}`
    })
    const countSql =
      aggregates.length > 0
        ? `SELECT count(*) AS total_count, ${aggregates.join(', ')} FROM ${table}`
        : `SELECT count(*) AS total_count FROM ${table}`
    const countResult = await pool.query(countSql)
    const stats = countResult.rows[0] ?? {}

    // 3. 样本值（单查询，最多 20 行，每列取至多 5 个不同非空值）
    const sampleSql =
      columns.length > 0
        ? `SELECT ${columns.map((col) => profileQuoteIdent(col.column_name)).join(', ')} FROM ${table} LIMIT 20`
        : `SELECT * FROM ${table} LIMIT 20`
    const sampleResult = await pool.query(sampleSql)

    const rowCount = Number(stats.total_count ?? 0)
    const profiles: ColumnDataProfile[] = columns.map((col, i) => {
      const samples: unknown[] = []
      const seen = new Set<string>()
      for (const row of sampleResult.rows) {
        const v = row[col.column_name]
        if (v !== null && v !== undefined && v !== '') {
          const key = String(v)
          if (!seen.has(key)) {
            seen.add(key)
            samples.push(v)
          }
          if (samples.length >= 5) break
        }
      }
      return {
        name: col.column_name,
        type: col.data_type,
        distinctCount: Number(stats[`d_${i}`] ?? 0),
        nullCount: rowCount - Number(stats[`n_${i}`] ?? 0),
        min: (stats[`mn_${i}`] ?? null) as number | string | null,
        max: (stats[`mx_${i}`] ?? null) as number | string | null,
        samples,
      }
    })

    return { table: tableName, rowCount, columns: profiles }
  } finally {
    await pool.end()
  }
}

/** 扫描所有用户表（默认最多 10 个）的数据轮廓 */
export async function scanAllDataProfiles(
  connectionId: string,
  maxTables = 10,
): Promise<TableDataProfile[]> {
  const pool = await getPool(connectionId)
  let tableNames: string[]
  try {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name LIMIT $1`,
      [maxTables],
    )
    tableNames = result.rows.map((r) => r.table_name as string)
  } finally {
    await pool.end()
  }
  const profiles: TableDataProfile[] = []
  for (const name of tableNames) {
    profiles.push(await scanDataProfile(connectionId, name))
  }
  return profiles
}

/** 生成 Markdown 表格格式的 Prompt 文本 */
export function buildDataProfileText(profiles: TableDataProfile[]): string {
  if (profiles.length === 0) return ''
  let text = '## 数据轮廓（辅助判断字段类型与基数）\n\n'
  for (const profile of profiles) {
    text += `### ${profile.table}（${profile.rowCount} 行）\n\n`
    text += '| 列 | 类型 | 唯一值 | NULL | 最小值 | 最大值 | 样本 |\n'
    text += '|----|------|--------|------|--------|--------|------|\n'
    for (const col of profile.columns) {
      const samples = col.samples
        .slice(0, 3)
        .map((s) => `\`${String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')}\``)
        .join(', ')
      const min = col.min !== null ? String(col.min).replace(/\|/g, '\\|') : ''
      const max = col.max !== null ? String(col.max).replace(/\|/g, '\\|') : ''
      text += `| ${col.name} | ${col.type} | ${col.distinctCount} | ${col.nullCount} | ${min} | ${max} | ${samples} |\n`
    }
    text += '\n'
  }
  return text
}
