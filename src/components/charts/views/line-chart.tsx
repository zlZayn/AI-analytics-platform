"use client"

import React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { useGroupedData } from "../hooks/use-grouped-data"
import { AXIS_CONFIG, GRID_CONFIG } from "../constants"
import { getColor, formatNumber, TooltipFormatter } from "../utils"
import { EmptyState } from "../empty-state"

export const LineChartView = React.memo(function LineChartView({
  data,
  xKey,
  yKey,
  colorKey,
  showLegend = true,
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  colorKey?: string
  showLegend?: boolean
}) {
  const sortTemporal = data.length > 0 && data.every((row) => row[xKey] == null || !Number.isNaN(Date.parse(String(row[xKey]))))
  const transformed = useGroupedData(data, xKey, yKey, colorKey, { sortTemporal, rejectDuplicates: true })
  if (!transformed.ok) return <EmptyState message={transformed.message} />
  const { groups, wideData } = transformed

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={wideData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid {...GRID_CONFIG} />
        <XAxis dataKey={xKey} {...AXIS_CONFIG} />
        <YAxis {...AXIS_CONFIG} tickFormatter={(v: number) => formatNumber(v)} />
        <Tooltip formatter={TooltipFormatter} />
        {groups.length > 0 ? (
          groups.map((g, i) => (
            <Line
              key={g}
              type="monotone"
              dataKey={g}
              stroke={getColor(i)}
              strokeWidth={2}
              dot={{ r: 3, fill: getColor(i) }}
              connectNulls={false}
            />
          ))
        ) : (
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={getColor(0)}
            strokeWidth={2}
            dot={{ r: 3, fill: getColor(0) }}
            connectNulls={false}
          />
        )}
        {groups.length > 0 && showLegend && (
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="plainline" />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
})
