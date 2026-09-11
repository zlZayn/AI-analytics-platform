import { NextRequest } from 'next/server'
import { AIConfigurationError, describeAIError, generateAnalysis, toClientDiagnostics } from '@/lib/ai-service'
import { collectAIContext, summarizeContext } from '@/lib/ai-context-service'
import { describeContextTrace } from '@/lib/ai-context'
import { prisma } from '@/lib/prisma'
import { apiFailure, apiSuccess } from '@/lib/api-response'

// AI 分析：单发请求 → 1..6 条建议（querySpec + displayConfig，或回退 sql + chart）
// 上下文采集与可见范围声明见 lib/ai-context.ts / lib/ai-visibility.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, message, conversationId, conversationHistory, referencedTables, businessContext } = body

    // 验证必填字段
    if (!connectionId || !message) {
      return apiFailure({ code: 'INVALID_REQUEST', message: '缺少必填字段: connectionId, message', retryable: false }, 400)
    }

    // 检查连接
    const connection = await prisma.connection.findUnique({ where: { id: connectionId } })
    if (!connection) {
      return apiFailure({ code: 'CONNECTION_NOT_FOUND', message: '连接不存在', retryable: false }, 404)
    }

    const context = await collectAIContext(connectionId, {
      conversationId,
      conversationHistory,
      referencedTables,
      businessContext,
    })

    // 会话标识：网关据此路由与提示词缓存（优先前端会话 ID，回退连接 ID）
    const sessionId = typeof conversationId === 'string' && conversationId.length > 0 ? conversationId : connectionId

    // 调用 AI 生成分析
    const result = await generateAnalysis(
      message,
      context.schemaContext,
      context.history,
      undefined,
      context.dataProfileText,
      context.businessContext,
      sessionId,
    )

    const usage = result.usage
    console.info(
      `[ai] ${describeContextTrace(summarizeContext(context))} items=${result.items.length} reason=${result.reason} attempts=${result.attempts}` +
        ` finish=${result.finishReason ?? "-"}` +
        (usage ? ` tokens=${usage.completionTokens ?? "?"}${usage.reasoningTokens ? `(reasoning ${usage.reasoningTokens})` : ""}` : ""),
    )
    if (result.reason !== "ok") console.warn(`[ai] 输出不可用：${result.message}`)
    return apiSuccess({ items: result.items, diagnostics: toClientDiagnostics(result) })
  } catch (error) {
    console.error('AI 分析失败', error)
    if (error instanceof AIConfigurationError) {
      return apiFailure({ code: 'AI_NOT_CONFIGURED', message: error.message, retryable: false }, 503)
    }
    // 具体原因（HTTP 状态 + 提供方原文）回传 UI，避免只显示「稍后重试」
    return apiFailure({
      code: 'AI_FAILED',
      message: `AI 分析失败：${describeAIError(error)}`,
      retryable: true,
    }, 500)
  }
}
