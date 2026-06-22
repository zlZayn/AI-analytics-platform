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
import { AXIS_CONFIG, GRID_CONFIG } from "../constants"
import { getColor, formatNumber, TooltipFormatter, computeBins } from "../utils"

export const HistogramView = React.memo(function HistogramView({
  data,
  xKey,
  fillKey,
}: {
  data: Record<string, unknown>[]
  xKey: string
  fillKey?: string
}) {
  const isCategorical = useMemo(() => {
    const sample = data.slice(0, 20).map((d) => d[xKey])
    const numericCount = sample.filter(
      (v) => v !== null && v !== undefined && !isNaN(Number(v)),
    ).length
    return numericCount < sample.length * 0.5
  }, [data, xKey])

  const groups = useMemo(() => {
    if (!fillKey) return []
    return Array.from(new Set(data.map((d) => String(d[fillKey] ?? ""))))
  }, [data, fillKey])

  // Categorical mode
  const categoricalData = useMemo(() => {
    if (!isCategorical) return []
    const counts: Record<string, number> = {}
    data.forEach((d) => {
      const key = String(d[xKey] ?? "")
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count }))
  }, [data, xKey, isCategorical])

  // Numerical mode
  const numericalData = useMemo(() => {
    if (isCategorical) return []
    const values = data.map((d) => Number(d[xKey])).filter((v) => !isNaN(v))
    return computeBins(values)
  }, [data, xKey, isCategorical])

  // Grouped numerical bins
  const groupedNumericalData = useMemo(() => {
    if (isCategorical || groups.length === 0 || !fillKey) return []

    const allValues = data.map((d) => Number(d[xKey])).filter((v) => !isNaN(v))
    const globalBins = computeBins(allValues)
    if (globalBins.length === 0) return []

    const maxVal = Math.max(...allValues)
    const fk = fillKey
    return globalBins.map((bin) => {
      const row: Record<string, unknown> = {
        bin: bin.bin,
        start: bin.start,
        end: bin.end,
      }
      groups.forEach((g) => {
        const groupValues = data
          .filter((d) => String(d[fk]) === g)
          .map((d) => Number(d[xKey]))
          .filter((v) => !isNaN(v))
        row[g] = groupValues.filter((v) =>
          bin.end === maxVal
            ? v >= bin.start && v <= bin.end
            : v >= bin.start && v < bin.end,
        ).length
      })
      return row
    })
  }, [data, xKey, fillKey, isCategorical, groups])

  if (isCategorical) {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={categoricalData}
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <CartesianGrid {...GRID_CONFIG} />
          <XAxis dataKey="name" {...AXIS_CONFIG} />
          <YAxis {...AXIS_CONFIG} />
          <Tooltip formatter={(value: unknown) => [formatNumber(value), "数量"]} />
          <Bar dataKey="count" fill={getColor(0)} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (groups.length > 0) {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={groupedNumericalData}
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <CartesianGrid {...GRID_CONFIG} />
          <XAxis dataKey="bin" {...AXIS_CONFIG} />
          <YAxis {...AXIS_CONFIG} />
          <Tooltip formatter={TooltipFormatter} />
          {groups.map((g, i) => (
            <Bar
              key={g}
              dataKey={g}
              fill={getColor(i)}
              radius={[3, 3, 0, 0]}
              stackId="stack"
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={numericalData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid {...GRID_CONFIG} />
        <XAxis dataKey="bin" {...AXIS_CONFIG} />
        <YAxis {...AXIS_CONFIG} />
        <Tooltip formatter={(value: unknown) => [formatNumber(value), "数量"]} />
        <Bar dataKey="count" fill={getColor(0)} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})
