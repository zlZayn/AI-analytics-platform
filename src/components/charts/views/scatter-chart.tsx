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
import { sampleScatterData } from "../transform"
import { ChartNotice } from "../chart-notice"

export const ScatterChartView = React.memo(function ScatterChartView({
  data,
  xKey,
  yKey,
  colorKey,
  pointLimit,
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  colorKey?: string
  pointLimit?: number
}) {
  const transformed = useMemo(
    () => sampleScatterData(data, xKey, yKey, colorKey, pointLimit),
    [data, xKey, yKey, colorKey, pointLimit],
  )
  const groups = useMemo(() => {
    if (!colorKey) return []
    return Array.from(new Set(transformed.points.map((d) => String(d[colorKey] ?? ""))))
  }, [transformed.points, colorKey])

  const groupedData = useMemo(() => {
    if (!colorKey || groups.length === 0)
      return [{ group: null, points: transformed.points }]
    return groups.map((g) => ({
      group: g,
      points: transformed.points.filter((d) => String(d[colorKey]) === g),
    }))
  }, [transformed.points, colorKey, groups])

  return (
    <div>
      {(transformed.invalidCount > 0 || transformed.sampled) && (
        <ChartNotice tone="muted">
          {transformed.invalidCount > 0 && `已过滤 ${transformed.invalidCount} 个非有限坐标。`}
          {transformed.sampled && ` 已从 ${transformed.validCount} 个有效点中确定性抽样 ${transformed.points.length} 个点。`}
        </ChartNotice>
      )}
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
    </div>
  )
})
