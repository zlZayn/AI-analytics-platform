import { NextRequest } from 'next/server'
import { generateSQL } from '@/lib/ai-service'
import { buildSchemaContext, scanSchema } from '@/lib/schema-service'
import { prisma } from '@/lib/prisma'
import { apiFailure, apiSuccess } from '@/lib/api-response'

// AI 分析
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, message, conversationId } = body

    // 验证必填字段
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

    // 获取对话历史
    let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
    if (conversationId) {
      const messages = await prisma.aIMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 10
      })
      conversationHistory = messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    }

    // 调用 AI 生成分析
    const result = await generateSQL(message, schemaContext, conversationHistory)

    return apiSuccess({ items: result.items })
  } catch (error) {
    console.error('AI 分析失败', error)
    const unavailable = error instanceof Error && /未配置|API Key/.test(error.message)
    return apiFailure({
      code: unavailable ? 'AI_NOT_CONFIGURED' : 'AI_FAILED',
      message: unavailable ? 'AI 服务未配置，请设置 AI_API_KEY' : 'AI 分析失败，请稍后重试',
      retryable: !unavailable,
    }, unavailable ? 503 : 500)
  }
}
