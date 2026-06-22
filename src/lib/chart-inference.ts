export interface ChartInferenceResult {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'table'
  title: string
  xAxis?: string
  yAxis?: string
  groupBy?: string
}

interface ColumnInfo {
  name: string
  type: string
}

export function inferChartType(
  columns: ColumnInfo[],
  rows: Record<string, unknown>[]
): ChartInferenceResult {
  // 识别列类型
  const timeColumns = columns.filter(c =>
    c.type.includes('time') || c.type.includes('date')
  )
  const numericColumns = columns.filter(c =>
    c.type.includes('int') || c.type.includes('numeric') || c.type.includes('float')
  )
  const textColumns = columns.filter(c =>
    c.type.includes('varchar') || c.type.includes('text')
  )

  // 规则 1: 有时间列 + 数值列 → 折线图
  if (timeColumns.length > 0 && numericColumns.length > 0) {
    return {
      type: 'line',
      title: '趋势分析',
      xAxis: timeColumns[0].name,
      yAxis: numericColumns[0].name,
      groupBy: textColumns[0]?.name
    }
  }

  // 规则 2: 有文本列 + 数值列，行数少 → 饼图
  if (textColumns.length > 0 && numericColumns.length > 0 && rows.length <= 10) {
    return {
      type: 'pie',
      title: '占比分析'
    }
  }

  // 规则 3: 有文本列 + 数值列 → 柱状图
  if (textColumns.length > 0 && numericColumns.length > 0) {
    return {
      type: 'bar',
      title: '分类对比',
      xAxis: textColumns[0].name,
      yAxis: numericColumns[0].name
    }
  }

  // 规则 4: 多个数值列 → 散点图
  if (numericColumns.length >= 2) {
    return {
      type: 'scatter',
      title: '分布分析',
      xAxis: numericColumns[0].name,
      yAxis: numericColumns[1].name
    }
  }

  // 默认: 表格
  return {
    type: 'table',
    title: '数据明细'
  }
}
