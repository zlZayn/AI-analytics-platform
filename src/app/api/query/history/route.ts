import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取查询历史
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: '缺少 connectionId' },
        { status: 400 }
      )
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
        createdAt: true
      }
    })

    return NextResponse.json({
      success: true,
      data: history.map(h => ({
        id: h.id,
        sql: h.sqlContent,
        rowCount: h.rowCount || 0,
        executionTimeMs: h.executionTimeMs || 0,
        status: h.status,
        createdAt: h.createdAt
      }))
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取历史失败' },
      { status: 500 }
    )
  }
}
