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
import { groupPieData } from "../transform"
import { ChartNotice } from "../chart-notice"
import { EmptyState } from "../empty-state"

export const PieChartView = React.memo(function PieChartView({
  data,
  nameKey,
  valueKey,
  categoryLimit,
}: {
  data: Record<string, unknown>[]
  nameKey: string
  valueKey: string
  categoryLimit?: number
}) {
  const transformed = useMemo(() => groupPieData(data, nameKey, valueKey, categoryLimit), [data, nameKey, valueKey, categoryLimit])

  if (!transformed.ok) return <EmptyState message={transformed.message} />
  const chartData = transformed.slices

  return (
    <div>
      {transformed.mergedCategoryCount > 0 && (
        <ChartNotice tone="muted">
          默认显示前 {transformed.categoryLimit} 类，其余 {transformed.mergedCategoryCount} 类已合并为“其他”。
        </ChartNotice>
      )}
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
    </div>
  )
})
