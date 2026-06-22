import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/query-engine'
import { inferChartType } from '@/lib/chart-inference'
import { prisma } from '@/lib/prisma'

// 执行 SQL 查询
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, sql, timeout } = body

    // 验证必填字段
    if (!connectionId || !sql) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: connectionId, sql' },
        { status: 400 }
      )
    }

    // 执行查询
    const result = await executeQuery(connectionId, sql, timeout || 10000)

    // 推断图表类型
    const chartConfig = inferChartType(result.columns, result.rows)

    // 保存查询历史
    try {
      await prisma.queryHistory.create({
        data: {
          userId: 'default-user',
          connectionId,
          sqlContent: sql,
          status: 'success',
          executionTimeMs: result.executionTimeMs,
          rowCount: result.rowCount
        }
      })
    } catch (e) {
      // 保存历史失败不影响查询结果
      console.error('保存查询历史失败:', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
        chartConfig
      }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查询执行失败' },
      { status: 500 }
    )
  }
}
