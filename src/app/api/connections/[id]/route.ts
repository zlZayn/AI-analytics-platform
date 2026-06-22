import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'

// 获取连接详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const connection = await prisma.connection.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        host: true,
        port: true,
        database: true,
        username: true,
        ssl: true,
        status: true,
        tableCount: true,
        dbVersion: true,
        lastConnectedAt: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!connection) {
      return NextResponse.json(
        { success: false, error: '连接不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: connection })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取连接详情失败' },
      { status: 500 }
    )
  }
}

// 更新连接
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, host, port, database, username, password, ssl } = body

    // 获取现有连接
    const existing = await prisma.connection.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '连接不存在' },
        { status: 404 }
      )
    }

    // 更新数据
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (host !== undefined) updateData.host = host
    if (port !== undefined) updateData.port = port
    if (database !== undefined) updateData.database = database
    if (username !== undefined) updateData.username = username
    if (password !== undefined) updateData.passwordEncrypted = encrypt(password)
    if (ssl !== undefined) updateData.ssl = ssl

    const connection = await prisma.connection.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, data: connection })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '更新连接失败' },
      { status: 500 }
    )
  }
}

// 删除连接
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const connection = await prisma.connection.findUnique({
      where: { id }
    })

    if (!connection) {
      return NextResponse.json(
        { success: false, error: '连接不存在' },
        { status: 404 }
      )
    }

    await prisma.connection.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '删除连接失败' },
      { status: 500 }
    )
  }
}
