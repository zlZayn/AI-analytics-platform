import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 保存查询
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, name, sql } = body

    if (!connectionId || !name || !sql) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      )
    }

    const saved = await prisma.savedQuery.create({
      data: {
        userId: 'default-user',
        connectionId,
        name,
        sqlContent: sql
      }
    })

    return NextResponse.json({ success: true, data: saved })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '保存失败' },
      { status: 500 }
    )
  }
}

// 删除保存的查询
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少 id' },
        { status: 400 }
      )
    }

    await prisma.savedQuery.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    )
  }
}

// 获取保存的查询列表
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

    return NextResponse.json({
      success: true,
      data: queries.map(q => ({
        id: q.id,
        name: q.name,
        sql: q.sqlContent,
        createdAt: q.createdAt
      }))
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取保存查询失败' },
      { status: 500 }
    )
  }
}
