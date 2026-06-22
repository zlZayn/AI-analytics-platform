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

  // 业务说明
  context += `这是一个药店会员系统的星型模型数据仓库。

## 表分类

维度表 (dim_): 提供分析视角的描述性字段
- dim_date: 日期维度 (date_key, year, quarter, month, is_weekend, is_holiday)
- dim_member: 会员维度 (name, phone, gender, level, segment, is_active, total_spent, order_count)
- dim_product: 商品维度 (name, category_l1, category_l2, brand, specification, dosage_form, price, is_rx, is_hot)
- dim_pharmacy: 门店维度 (name, city, district, store_type)
- dim_promotion: 促销维度 (name, type, min_amount, discount_amount, discount_rate)
- dim_payment: 支付方式 (code, name)

事实表 (fact_): 记录业务事件的数值型数据
- fact_orders: 订单行级事实 (order_no, order_date, member_id, pharmacy_id, product_id, promotion_id, payment_id, quantity, unit_price, discount, pay_amount, points_earned, status)
- fact_behavior: 用户行为 (member_id, product_id, action, channel, referrer)
- fact_inventory: 库存变动 (product_id, pharmacy_id, change_type, quantity)
- fact_refunds: 退款 (order_no, order_id, member_id, product_id, pharmacy_id, refund_amount, refund_reason, refund_date)

## 常用 JOIN 模式

- 订单+商品: fact_orders JOIN dim_product ON fact_orders.product_id = dim_product.id
- 订单+门店: fact_orders JOIN dim_pharmacy ON fact_orders.pharmacy_id = dim_pharmacy.id
- 订单+会员: fact_orders JOIN dim_member ON fact_orders.member_id = dim_member.id
- 行为+商品: fact_behavior JOIN dim_product ON fact_behavior.product_id = dim_product.id
- 退款+商品: fact_refunds JOIN dim_product ON fact_refunds.product_id = dim_product.id

## 常用分析

- 品类销售: SELECT dp.category_l2, SUM(fo.pay_amount) FROM fact_orders fo JOIN dim_product dp ON fo.product_id=dp.id GROUP BY dp.category_l2
- 会员消费: SELECT dm.level, AVG(fo.pay_amount) FROM fact_orders fo JOIN dim_member dm ON fo.member_id=dm.id GROUP BY dm.level
- 门店业绩: SELECT dph.name, SUM(fo.pay_amount) FROM fact_orders fo JOIN dim_pharmacy dph ON fo.pharmacy_id=dph.id GROUP BY dph.name
- 行为转化: SELECT action, COUNT(*) FROM fact_behavior GROUP BY action
- 退款原因: SELECT refund_reason, COUNT(*) FROM fact_refunds GROUP BY refund_reason

`

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
