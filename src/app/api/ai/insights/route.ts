import { NextRequest } from 'next/server'
import { generateSQL } from '@/lib/ai-service'
import { buildSchemaContext, scanSchema } from '@/lib/schema-service'
import { prisma } from '@/lib/prisma'
import { apiFailure, apiSuccess } from '@/lib/api-response'

// 生成分析推荐
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, message } = body

    if (!connectionId || !message) {
      return apiFailure({ code: 'INVALID_REQUEST', message: '缺少必填字段: connectionId, message', retryable: false }, 400)
    }

    // 检查连接
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    })

    if (!connection) {
      return apiFailure({ code: 'CONNECTION_NOT_FOUND', message: '连接不存在', retryable: false }, 404)
    }

    // 获取或扫描 Schema
    let schema = null
    const cached = await prisma.schemaSnapshot.findFirst({
      where: {
        connectionId,
        status: 'active'
      },
      orderBy: { version: 'desc' }
    })

    if (cached) {
      schema = cached.schemaJson as unknown as Awaited<ReturnType<typeof scanSchema>>
    } else {
      schema = await scanSchema(connectionId)
    }

    // 构建 Schema 上下文
    const schemaContext = buildSchemaContext(schema)

    // 生成分析
    const result = await generateSQL(message, schemaContext)

    return apiSuccess({ items: result.items })
  } catch (error) {
    console.error('生成分析推荐失败', error)
    return apiFailure({ code: 'AI_INSIGHTS_FAILED', message: '生成分析失败，请稍后重试', retryable: true })
  }
}
