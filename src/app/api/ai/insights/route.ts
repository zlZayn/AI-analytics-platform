import { NextRequest } from 'next/server'
import { AIConfigurationError, describeAIError, generateAnalysis } from '@/lib/ai-service'
import { collectAIContext, summarizeContext } from '@/lib/ai-context-service'
import { describeContextTrace } from '@/lib/ai-context'
import { prisma } from '@/lib/prisma'
import { apiFailure, apiSuccess } from '@/lib/api-response'

// AI 分析推荐：与 /api/ai 共用上下文采集与错误呈现；当前无前端调用方
// （保留原因见 .agents/notes/2026-09-11-ai-assistant-contract-and-context.md P5）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, message, conversationId, conversationHistory } = body

    if (!connectionId || !message) {
      return apiFailure({ code: 'INVALID_REQUEST', message: '缺少必填字段: connectionId, message', retryable: false }, 400)
    }

    const connection = await prisma.connection.findUnique({ where: { id: connectionId } })
    if (!connection) {
      return apiFailure({ code: 'CONNECTION_NOT_FOUND', message: '连接不存在', retryable: false }, 404)
    }

    const context = await collectAIContext(connectionId, { conversationId, conversationHistory })

    const result = await generateAnalysis(
      message,
      context.schemaContext,
      context.history,
      undefined,
      context.dataProfileText,
      "",
      typeof conversationId === 'string' && conversationId.length > 0 ? conversationId : connectionId,
    )

    console.info(`[ai] insights ${describeContextTrace(summarizeContext(context))} items=${result.items.length}`)
    return apiSuccess({ items: result.items })
  } catch (error) {
    console.error('生成分析推荐失败', error)
    if (error instanceof AIConfigurationError) {
      return apiFailure({ code: 'AI_NOT_CONFIGURED', message: error.message, retryable: false }, 503)
    }
    return apiFailure({
      code: 'AI_INSIGHTS_FAILED',
      message: `生成分析失败：${describeAIError(error)}`,
      retryable: true,
    }, 500)
  }
}
