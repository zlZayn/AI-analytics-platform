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
  // 确保 name 为字符串，value 为数字
  const chartData = useMemo(() => {
    return data.map((d) => ({
      [nameKey]: String(d[nameKey] ?? ""),
      [valueKey]: Number(d[valueKey]) || 0,
    }))
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
          dataKey={valueKey}
          nameKey={nameKey}
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
