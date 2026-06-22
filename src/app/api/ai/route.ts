import { NextRequest, NextResponse } from 'next/server'
import { generateSQL } from '@/lib/ai-service'
import { buildSchemaContext, scanSchema } from '@/lib/schema-service'
import { prisma } from '@/lib/prisma'

// AI 分析
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, message, conversationId } = body

    // 验证必填字段
    if (!connectionId || !message) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: connectionId, message' },
        { status: 400 }
      )
    }

    // 检查连接
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    })

    if (!connection) {
      return NextResponse.json(
        { success: false, error: '连接不存在' },
        { status: 404 }
      )
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
        take: 10 // 只取最近 10 条
      })
      conversationHistory = messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    }

    // 调用 AI 生成 SQL
    const result = await generateSQL(message, schemaContext, conversationHistory)

    return NextResponse.json({
      success: true,
      data: {
        sql: result.sql,
        explanation: result.explanation
      }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'AI 分析失败' },
      { status: 500 }
    )
  }
}
