import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiFailure, apiSuccess } from '@/lib/api-response'

// 获取查询历史
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return apiFailure({ code: 'INVALID_REQUEST', message: '缺少 connectionId', retryable: false }, 400)
    }

    const history = await prisma.queryHistory.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        sqlContent: true,
        rowCount: true,
        executionTimeMs: true,
        status: true,
        errorCode: true,
        createdAt: true
      }
    })

    return apiSuccess(history.map(h => ({
        id: h.id,
        sql: h.sqlContent,
        rowCount: h.rowCount || 0,
        executionTimeMs: h.executionTimeMs || 0,
        status: h.status,
        errorCode: h.errorCode,
        createdAt: h.createdAt
      })))
  } catch (error) {
    console.error('获取查询历史失败', error)
    return apiFailure({ code: 'QUERY_HISTORY_FAILED', message: '获取查询历史失败，请稍后重试', retryable: true })
  }
}
