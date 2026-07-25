import { Client, Pool, type PoolConfig, type QueryResult as PgQueryResult } from "pg"
import { decrypt } from "./encryption"
import { prisma } from "./prisma"
import { PoolRegistry } from "./pool-registry"
import { executeCancelable } from "./query-cancellation"
import { validateSQL } from "./sql-validator"

export interface QueryResult {
  columns: { name: string; type: string }[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
  returnedRowCount: number
  truncated: boolean
  rowLimit: number
}

const MAX_RETURNED_ROWS = 5000
const DEFAULT_TIMEOUT_MS = 10000
const MAX_TIMEOUT_MS = 60000
const poolRegistry = new PoolRegistry<Pool>({ maxEntries: 12, idleMs: 5 * 60_000 })

async function getPool(connectionId: string): Promise<Pool> {
  return poolRegistry.getOrCreate(connectionId, async () => {
    const connection = await prisma.connection.findUnique({ where: { id: connectionId } })
    if (!connection) throw new Error("连接不存在")

    return new Pool({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: decrypt(connection.passwordEncrypted),
      ssl: connection.ssl,
      max: connection.poolMax,
      idleTimeoutMillis: connection.idleTimeout * 1000,
      connectionTimeoutMillis: 5000,
    })
  })
}

export async function invalidatePool(connectionId: string): Promise<void> {
  await poolRegistry.invalidate(connectionId)
}

export async function shutdownPools(): Promise<void> {
  await poolRegistry.closeAll()
}

export async function executeQuery(
  connectionId: string,
  sql: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<QueryResult> {
  const startTime = Date.now()
  const validation = validateSQL(sql)
  if (!validation.valid) throw new Error(validation.error)
  if (signal?.aborted) throw new DOMException("查询已取消", "AbortError")

  const pool = await getPool(connectionId)
  const boundedTimeout = Math.min(MAX_TIMEOUT_MS, Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS))
  const client = await pool.connect()
  let invalidateAfterRelease = false

  try {
    await client.query("BEGIN")
    await client.query("SET TRANSACTION READ ONLY")
    await client.query("SELECT set_config('statement_timeout', $1, true)", [String(Math.floor(boundedTimeout))])
    const backend = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    const backendPid = backend.rows[0].pid
    const wrappedSQL = `SELECT * FROM (${validation.sanitizedSQL!.trim()}) AS __query_result LIMIT ${MAX_RETURNED_ROWS + 1}`
    const result = await executeCancelable(
      () => client.query(wrappedSQL),
      () => cancelBackend(pool.options, backendPid),
      signal,
    ) as PgQueryResult<Record<string, unknown>>
    await client.query("COMMIT")

    const truncated = result.rows.length > MAX_RETURNED_ROWS
    const rows = truncated ? result.rows.slice(0, MAX_RETURNED_ROWS) : result.rows
    return {
      columns: result.fields.map((field) => ({ name: field.name, type: mapPGType(field.dataTypeID) })),
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - startTime,
      returnedRowCount: rows.length,
      truncated,
      rowLimit: MAX_RETURNED_ROWS,
    }
  } catch (error) {
    invalidateAfterRelease = isUnrecoverableConnectionError(error)
    throw error
  } finally {
    await client.query("ROLLBACK").catch(() => undefined)
    client.release()
    if (invalidateAfterRelease) await invalidatePool(connectionId).catch(() => undefined)
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
      await client.query("SELECT 1")
      return { success: true, message: "连接成功", latencyMs: Date.now() - startTime }
    } finally {
      client.release()
    }
  } catch (error) {
    if (isUnrecoverableConnectionError(error)) await invalidatePool(connectionId).catch(() => undefined)
    return { success: false, message: "连接失败，请检查数据库地址和只读账号配置", latencyMs: Date.now() - startTime }
  }
}

async function cancelBackend(config: PoolConfig, backendPid: number): Promise<void> {
  const cancellationClient = new Client(config)
  try {
    await cancellationClient.connect()
    await cancellationClient.query("SELECT pg_cancel_backend($1)", [backendPid])
  } finally {
    await cancellationClient.end().catch(() => undefined)
  }
}

function isUnrecoverableConnectionError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""
  return ["28P01", "28000", "3D000"].includes(code)
}

function mapPGType(oid: number): string {
  const typeMap: Record<number, string> = {
    23: "integer", 20: "bigint", 21: "smallint", 1700: "numeric",
    700: "real", 701: "double precision", 1043: "varchar", 25: "text",
    16: "boolean", 1114: "timestamp", 1184: "timestamptz", 1082: "date", 1083: "time",
  }
  return typeMap[oid] || "unknown"
}
