import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'
import { Pool } from 'pg'

// 获取连接列表
export async function GET(request: NextRequest) {
  try {
    const connections = await prisma.connection.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        host: true,
        port: true,
        database: true,
        status: true,
        tableCount: true,
        lastConnectedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, data: connections })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取连接列表失败' },
      { status: 500 }
    )
  }
}

// 创建连接
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, host, port, database, username, password, ssl } = body

    // 验证必填字段
    if (!name || !host || !database || !username || !password) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      )
    }

    // 测试连接
    const testClient = new Pool({
      host,
      port: port || 5432,
      database,
      user: username,
      password,
      ssl: ssl || false,
      connectionTimeoutMillis: 5000
    })

    try {
      await testClient.query('SELECT 1')
      await testClient.end()
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `连接测试失败: ${error instanceof Error ? error.message : '未知错误'}` },
        { status: 400 }
      )
    }

    // 加密密码
    const passwordEncrypted = encrypt(password)

    // 获取表数量
    const pool = new Pool({
      host,
      port: port || 5432,
      database,
      user: username,
      password,
      ssl: ssl || false
    })

    let tableCount = 0
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `)
      tableCount = parseInt(result.rows[0].count)
    } finally {
      await pool.end()
    }

    // 创建连接
    const connection = await prisma.connection.create({
      data: {
        userId: 'default-user', // MVP 阶段使用默认用户
        name,
        description,
        host,
        port: port || 5432,
        database,
        username,
        passwordEncrypted,
        ssl: ssl || false,
        status: 'connected',
        tableCount,
        lastConnectedAt: new Date()
      }
    })

    return NextResponse.json({ success: true, data: connection })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '创建连接失败' },
      { status: 500 }
    )
  }
}
