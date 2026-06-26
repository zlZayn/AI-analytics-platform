"use client"

import React, { useMemo } from "react"
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

  // 动态计算柱子宽度
  const barLayout = useMemo(() => {
    const categoryCount = wideData.length
    const groupCount = groups.length || 1

    // 分组多时用堆叠，避免柱子太细
    const useStack = groupCount > 3

    // 动态柱子宽度
    const maxBarSize = categoryCount <= 5 ? 50 : categoryCount <= 10 ? 35 : 25

    return { useStack, maxBarSize }
  }, [wideData.length, groups.length])

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
              radius={barLayout.useStack ? (i === groups.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]) : [3, 3, 0, 0]}
              maxBarSize={barLayout.maxBarSize}
              stackId={barLayout.useStack ? "stack" : undefined}
            />
          ))
        ) : (
          <Bar
            dataKey={yKey}
            fill={getColor(0)}
            radius={[3, 3, 0, 0]}
            maxBarSize={barLayout.maxBarSize}
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
