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
import { EmptyState } from "../empty-state"

export const BarChartView = React.memo(function BarChartView({
  data,
  xKey,
  yKey,
  fillKey,
  showLegend = true,
  mode = "grouped",
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  fillKey?: string
  showLegend?: boolean
  mode?: "grouped" | "stacked" | "normalized"
}) {
  const transformed = useGroupedData(data, xKey, yKey, fillKey, { rejectDuplicates: true })
  if (!transformed.ok) return <EmptyState message={transformed.message} />
  const { groups, wideData } = transformed

  const maxBarSize = wideData.length <= 5 ? 50 : wideData.length <= 10 ? 35 : 25

  // X轴标签角度
  const xAxisAngle = wideData.length > 6 ? -45 : 0
  const xAxisHeight = wideData.length > 6 ? 60 : 30

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={wideData}
        margin={{ top: 5, right: 20, bottom: xAxisHeight, left: 10 }}
        barCategoryGap="15%"
        barGap={2}
        stackOffset={mode === "normalized" ? "expand" : "none"}
      >
        <CartesianGrid {...GRID_CONFIG} />
        <XAxis
          dataKey={xKey}
          {...AXIS_CONFIG}
          angle={xAxisAngle}
          textAnchor={xAxisAngle ? "end" : "middle"}
          height={xAxisHeight}
          interval={0}
        />
        <YAxis {...AXIS_CONFIG} tickFormatter={(v: number) => formatNumber(v)} />
        <Tooltip formatter={TooltipFormatter} />
        {groups.length > 0 ? (
          groups.map((g, i) => (
            <Bar
              key={g}
              dataKey={g}
              fill={getColor(i)}
              radius={mode !== "grouped" ? (i === groups.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]) : [3, 3, 0, 0]}
              maxBarSize={maxBarSize}
              stackId={mode === "grouped" ? undefined : "stack"}
            />
          ))
        ) : (
          <Bar
            dataKey={yKey}
            fill={getColor(0)}
            radius={[3, 3, 0, 0]}
            maxBarSize={maxBarSize}
          />
        )}
        {groups.length > 0 && showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="square"
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
})
