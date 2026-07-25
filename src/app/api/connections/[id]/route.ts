import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { invalidatePool } from '@/lib/query-engine'
import { apiFailure } from '@/lib/api-response'

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
    console.error('获取连接详情失败', error)
    return apiFailure('获取连接详情失败，请稍后重试', 500, 'CONNECTION_READ_FAILED', true)
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

    await invalidatePool(id)

    return NextResponse.json({ success: true, data: connection })
  } catch (error) {
    console.error('更新连接失败', error)
    return apiFailure('更新连接失败，请稍后重试', 500, 'CONNECTION_UPDATE_FAILED', true)
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

    await invalidatePool(id)

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除连接失败', error)
    return apiFailure('删除连接失败，请稍后重试', 500, 'CONNECTION_DELETE_FAILED', true)
  }
}
