import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiFailure, apiSuccess } from '@/lib/api-response'

// 保存查询
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, name, sql } = body

    if (!connectionId || !name || !sql) {
      return apiFailure({ code: 'INVALID_REQUEST', message: '缺少必填字段', retryable: false }, 400)
    }

    const saved = await prisma.savedQuery.create({
      data: {
        userId: 'default-user',
        connectionId,
        name,
        sqlContent: sql
      }
    })

    return apiSuccess(saved)
  } catch (error) {
    console.error('保存查询失败', error)
    return apiFailure({ code: 'SAVED_QUERY_CREATE_FAILED', message: '保存查询失败，请稍后重试', retryable: true })
  }
}

// 删除保存的查询
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return apiFailure({ code: 'INVALID_REQUEST', message: '缺少 id', retryable: false }, 400)
    }

    await prisma.savedQuery.delete({ where: { id } })

    return apiSuccess({ deleted: true })
  } catch (error) {
    console.error('删除保存查询失败', error)
    return apiFailure({ code: 'SAVED_QUERY_DELETE_FAILED', message: '删除保存查询失败，请稍后重试', retryable: true })
  }
}

// 获取保存的查询列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return apiFailure({ code: 'INVALID_REQUEST', message: '缺少 connectionId', retryable: false }, 400)
    }

    const queries = await prisma.savedQuery.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        sqlContent: true,
        createdAt: true
      }
    })

    return apiSuccess(queries.map(q => ({
        id: q.id,
        name: q.name,
        sql: q.sqlContent,
        createdAt: q.createdAt
      })))
  } catch (error) {
    console.error('获取保存查询失败', error)
    return apiFailure({ code: 'SAVED_QUERY_LIST_FAILED', message: '获取保存查询失败，请稍后重试', retryable: true })
  }
}
