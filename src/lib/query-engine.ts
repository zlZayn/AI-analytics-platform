import { Pool, PoolClient } from 'pg'
import { decrypt } from './encryption'
import { prisma } from './prisma'
import { validateSQL } from './sql-validator'

export interface QueryResult {
  columns: { name: string; type: string }[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
}

const poolCache = new Map<string, Pool>()

async function getPool(connectionId: string): Promise<Pool> {
  // 检查缓存
  if (poolCache.has(connectionId)) {
    return poolCache.get(connectionId)!
  }

  // 获取连接配置
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId }
  })

  if (!connection) {
    throw new Error('连接不存在')
  }

  // 解密密码
  const password = decrypt(connection.passwordEncrypted)

  // 创建连接池
  const pool = new Pool({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.username,
    password,
    ssl: connection.ssl,
    max: connection.poolMax,
    idleTimeoutMillis: connection.idleTimeout * 1000
  })

  // 缓存
  poolCache.set(connectionId, pool)

  return pool
}

export async function executeQuery(
  connectionId: string,
  sql: string,
  timeoutMs: number = 10000
): Promise<QueryResult> {
  const startTime = Date.now()

  // 验证 SQL
  const validation = validateSQL(sql)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const pool = await getPool(connectionId)

  // 执行查询（带超时）
  const client = await pool.connect()
  try {
    const result = await Promise.race([
      client.query(validation.sanitizedSQL!),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('查询超时')), timeoutMs)
      )
    ])

    return {
      columns: result.fields.map(f => ({
        name: f.name,
        type: mapPGType(f.dataTypeID)
      })),
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      executionTimeMs: Date.now() - startTime
    }
  } finally {
    client.release()
  }
}

export async function testConnection(connectionId: string): Promise<{
  success: boolean
  message: string
  latencyMs: number
}> {
  const startTime = Date.now()

  try {
    const pool = await getPool(connectionId)
    const client = await pool.connect()

    try {
      await client.query('SELECT 1')
      return {
        success: true,
        message: '连接成功',
        latencyMs: Date.now() - startTime
      }
    } finally {
      client.release()
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '连接失败',
      latencyMs: Date.now() - startTime
    }
  }
}

function mapPGType(oid: number): string {
  const typeMap: Record<number, string> = {
    23: 'integer',
    20: 'bigint',
    21: 'smallint',
    1700: 'numeric',
    700: 'real',
    701: 'double precision',
    1043: 'varchar',
    25: 'text',
    16: 'boolean',
    1114: 'timestamp',
    1184: 'timestamptz',
    1082: 'date',
    1083: 'time'
  }
  return typeMap[oid] || 'unknown'
}
