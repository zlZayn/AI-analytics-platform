import { NextRequest, NextResponse } from 'next/server'
import { generateInsights } from '@/lib/ai-service'
import { buildSchemaContext, scanSchema } from '@/lib/schema-service'
import { prisma } from '@/lib/prisma'

// 生成洞察推荐
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, message } = body

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

    // 生成洞察
    const insights = await generateInsights(message, schemaContext)

    return NextResponse.json({
      success: true,
      data: { insights }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '生成洞察失败' },
      { status: 500 }
    )
  }
}
