"use client"

import React, { useMemo } from "react"
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { AXIS_CONFIG, GRID_CONFIG } from "../constants"
import { getColor, formatNumber, TooltipFormatter } from "../utils"

export const ScatterChartView = React.memo(function ScatterChartView({
  data,
  xKey,
  yKey,
  colorKey,
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  colorKey?: string
}) {
  const groups = useMemo(() => {
    if (!colorKey) return []
    return Array.from(new Set(data.map((d) => String(d[colorKey] ?? ""))))
  }, [data, colorKey])

  const groupedData = useMemo(() => {
    if (!colorKey || groups.length === 0)
      return [{ group: null, points: data }]
    return groups.map((g) => ({
      group: g,
      points: data.filter((d) => String(d[colorKey]) === g),
    }))
  }, [data, colorKey, groups])

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid {...GRID_CONFIG} />
        <XAxis dataKey={xKey} type="number" {...AXIS_CONFIG} />
        <YAxis
          dataKey={yKey}
          type="number"
          {...AXIS_CONFIG}
          tickFormatter={(v: number) => formatNumber(v)}
        />
        <Tooltip formatter={TooltipFormatter} />
        {groupedData.map((g, i) => (
          <Scatter
            key={g.group ?? "default"}
            name={g.group ?? xKey}
            data={g.points}
            fill={getColor(i)}
          />
        ))}
        {groups.length > 0 && (
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
        )}
      </ScatterChart>
    </ResponsiveContainer>
  )
})
