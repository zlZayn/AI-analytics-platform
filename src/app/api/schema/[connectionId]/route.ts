import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scanSchema } from '@/lib/schema-service'

// 获取 Schema
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const { connectionId } = await params
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    // 检查连接是否存在
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    })

    if (!connection) {
      return NextResponse.json(
        { success: false, error: '连接不存在' },
        { status: 404 }
      )
    }

    // 检查是否有缓存的 Schema
    if (!refresh) {
      const cached = await prisma.schemaSnapshot.findFirst({
        where: {
          connectionId,
          status: 'active'
        },
        orderBy: { version: 'desc' }
      })

      if (cached) {
        return NextResponse.json({
          success: true,
          data: {
            version: cached.version,
            scannedAt: cached.scannedAt,
            ...cached.schemaJson as Record<string, unknown>
          }
        })
      }
    }

    // 扫描 Schema
    const schema = await scanSchema(connectionId)

    // 保存快照
    const tableCount = schema.tables.length
    const columnCount = schema.tables.reduce((sum, t) => sum + t.columns.length, 0)
    const relationCount = schema.relations.length

    await prisma.schemaSnapshot.create({
      data: {
        connectionId,
        version: schema.version,
        schemaJson: schema as unknown as Record<string, unknown> as any,
        tableCount,
        columnCount,
        relationCount,
        status: 'active'
      }
    })

    // 更新连接的表数量
    await prisma.connection.update({
      where: { id: connectionId },
      data: { tableCount }
    })

    return NextResponse.json({
      success: true,
      data: {
        version: schema.version,
        scannedAt: schema.scannedAt,
        tables: schema.tables,
        relations: schema.relations
      }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取 Schema 失败' },
      { status: 500 }
    )
  }
}
