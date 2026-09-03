import { NextRequest } from 'next/server'
import { generateAnalysis } from '@/lib/ai-service'
import { buildDataProfileText, buildSchemaContext, scanAllDataProfiles, scanDataProfile, scanSchema } from '@/lib/schema-service'
import { prisma } from '@/lib/prisma'
import { apiFailure, apiSuccess } from '@/lib/api-response'

// AI 分析
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, message, conversationId, conversationHistory: bodyHistory, referencedTables, businessContext } = body

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

    // 获取对话历史：优先使用前端会话传入的历史（含最新问题上下文），否则按 conversationId 从库中加载
    let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
    if (Array.isArray(bodyHistory) && bodyHistory.length > 0) {
      conversationHistory = bodyHistory
    } else if (conversationId) {
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

    // 数据轮廓（辅助 AI 判断字段类型与基数；失败不阻断主流程）
    // 用户显式 @提及 的表：只扫这些表（不受 6 表上限约束）；未提及：自动扫前 6 表
    let dataProfileText = ''
    try {
      const tables = Array.isArray(referencedTables)
        ? referencedTables.filter((t: unknown): t is string => typeof t === 'string' && t.length > 0)
        : []
      if (tables.length > 0) {
        const profiles = await Promise.all(
          tables.map((name) => scanDataProfile(connectionId, name).catch(() => null))
        )
        dataProfileText = buildDataProfileText(profiles.filter((p): p is NonNullable<typeof p> => p !== null))
      } else {
        const profiles = await scanAllDataProfiles(connectionId, 6)
        dataProfileText = buildDataProfileText(profiles)
      }
    } catch {
      dataProfileText = ''
    }

    // 业务口径（RAG/企业上下文融合预留）：可选的业务规则文本，注入提示词；AI 遵守并在 context 回传引用
    const businessContextText =
      typeof businessContext === "string" && businessContext.trim().length > 0
        ? businessContext.trim()
        : ""

    // 调用 AI 生成分析
    const result = await generateAnalysis(
      message,
      schemaContext,
      conversationHistory,
      undefined,
      dataProfileText,
      businessContextText,
    )

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
