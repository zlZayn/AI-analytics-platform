import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { invalidatePool } from '@/lib/query-engine'
import { apiFailure, apiSuccess } from '@/lib/api-response'

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
      return apiFailure({ code: 'CONNECTION_NOT_FOUND', message: '连接不存在', retryable: false }, 404)
    }

    return apiSuccess(connection)
  } catch (error) {
    console.error('获取连接详情失败', error)
    return apiFailure({ code: 'CONNECTION_READ_FAILED', message: '获取连接详情失败，请稍后重试', retryable: true })
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
      return apiFailure({ code: 'CONNECTION_NOT_FOUND', message: '连接不存在', retryable: false }, 404)
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

    return apiSuccess(connection)
  } catch (error) {
    console.error('更新连接失败', error)
    return apiFailure({ code: 'CONNECTION_UPDATE_FAILED', message: '更新连接失败，请稍后重试', retryable: true })
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
      return apiFailure({ code: 'CONNECTION_NOT_FOUND', message: '连接不存在', retryable: false }, 404)
    }

    await prisma.connection.delete({
      where: { id }
    })

    await invalidatePool(id)

    return apiSuccess({ deleted: true })
  } catch (error) {
    console.error('删除连接失败', error)
    return apiFailure({ code: 'CONNECTION_DELETE_FAILED', message: '删除连接失败，请稍后重试', retryable: true })
  }
}
