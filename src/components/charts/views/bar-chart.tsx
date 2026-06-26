"use client"

import React from "react"
import {
  BarChart,
  Bar,
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

export const BarChartView = React.memo(function BarChartView({
  data,
  xKey,
  yKey,
  fillKey,
  showLegend = true,
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  fillKey?: string
  showLegend?: boolean
}) {
  const { groups, wideData } = useGroupedData(data, xKey, yKey, fillKey)

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={wideData}
        margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        barCategoryGap="20%"
        barGap={2}
      >
        <CartesianGrid {...GRID_CONFIG} />
        <XAxis dataKey={xKey} {...AXIS_CONFIG} />
        <YAxis {...AXIS_CONFIG} tickFormatter={(v: number) => formatNumber(v)} />
        <Tooltip formatter={TooltipFormatter} />
        {groups.length > 0 ? (
          groups.map((g, i) => (
            <Bar
              key={g}
              dataKey={g}
              fill={getColor(i)}
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
          ))
        ) : (
          <Bar
            dataKey={yKey}
            fill={getColor(0)}
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
          />
        )}
        {groups.length > 0 && showLegend && (
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
})
