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
