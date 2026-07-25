import { NextRequest } from 'next/server'
import { executeQuery } from '@/lib/query-engine'
import { prisma } from '@/lib/prisma'
import { apiFailure, apiSuccess, requestId, safeQueryError } from '@/lib/api-response'

// 执行 SQL 查询
export async function POST(request: NextRequest) {
  const id = requestId()
  const startedAt = Date.now()
  let connectionId: string | undefined
  let sql = ""
  try {
    const body = await request.json()
    connectionId = body.connectionId
    sql = typeof body.sql === 'string' ? body.sql : ''
    const timeout = body.timeout

    // 验证必填字段
    if (!connectionId || !sql) {
      return apiFailure({ code: 'INVALID_REQUEST', message: '缺少必填字段: connectionId, sql', retryable: false }, 400, id)
    }

    // 执行查询
    const result = await executeQuery(connectionId, sql, timeout || 10000, request.signal)

    // 保存查询历史
    try {
      await prisma.queryHistory.create({
        data: {
          userId: 'default-user',
          connectionId,
          sqlContent: sql,
          status: 'success',
          executionTimeMs: result.executionTimeMs,
          rowCount: result.rowCount
        }
      })
    } catch (e) {
      // 保存历史失败不影响查询结果
      console.error('保存查询历史失败:', e)
    }

    return apiSuccess({
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        returnedRowCount: result.returnedRowCount,
        truncated: result.truncated,
        rowLimit: result.rowLimit,
        executionTimeMs: result.executionTimeMs,
      }, undefined, id)
  } catch (error) {
    const safe = safeQueryError(error)
    if (connectionId && sql) {
      const status = safe.code === 'QUERY_TIMEOUT' ? 'timeout' : safe.code === 'QUERY_CANCELLED' ? 'cancelled' : 'error'
      await prisma.queryHistory.create({ data: {
        userId: 'default-user',
        connectionId,
        sqlContent: sql,
        status,
        executionTimeMs: Date.now() - startedAt,
        errorCode: safe.code,
        errorMessage: safe.message,
      } }).catch(() => undefined)
    }
    const responseStatus = safe.code === 'INVALID_QUERY' ? 400
      : safe.code === 'QUERY_CANCELLED' ? 499
      : safe.code === 'QUERY_TIMEOUT' ? 504
      : safe.code === 'CONNECTION_NOT_FOUND' ? 404
      : 500
    return apiFailure(safe, responseStatus, id)
  }
}
