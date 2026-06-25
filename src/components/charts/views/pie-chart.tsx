"use client"

import React, { useMemo } from "react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { getColor, formatNumber } from "../utils"

export const PieChartView = React.memo(function PieChartView({
  data,
  nameKey,
  valueKey,
}: {
  data: Record<string, unknown>[]
  nameKey: string
  valueKey: string
}) {
  // 按分类字段分组，聚合数值字段
  const chartData = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const d of data) {
      const name = String(d[nameKey] ?? "未知")
      const val = Number(d[valueKey]) || 0
      grouped.set(name, (grouped.get(name) || 0) + val)
    }
    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20) // 最多 20 个扇区
  }, [data, nameKey, valueKey])

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={110}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={getColor(i)} />
          ))}
        </Pie>
        <Tooltip formatter={(value: unknown) => formatNumber(value)} />
      </PieChart>
    </ResponsiveContainer>
  )
})
