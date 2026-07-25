"use client"

import React, { useMemo } from "react"
import type { CorrelationMethod } from "../types"
import { MAX_CORR_COLUMNS } from "../constants"
import { findNumericColumns } from "../correlation-matrix"
import { useCorrelationMatrix } from "../use-correlation-matrix"
import { ChartNotice } from "../chart-notice"
import { EmptyState } from "../empty-state"

export const CorrelationHeatmap = React.memo(function CorrelationHeatmap({
  data,
  method = "pearson",
  columns,
}: {
  data: Record<string, unknown>[]
  method?: CorrelationMethod
  columns?: string[]
}) {
  const numericColumns = useMemo(() => columns ?? findNumericColumns(data), [columns, data])
  const { loading, result, error } = useCorrelationMatrix(data, numericColumns, method)

  if (loading && !result) return <EmptyState message="正在计算相关矩阵..." />
  if (error) return <EmptyState message={error} />
  if (!result || result.labels.length === 0) return <EmptyState message="没有可计算的数值列" />

  const { cells, labels, truncated } = result
  const size = Math.max(32, Math.min(60, 500 / labels.length))
  const marginLeft = 80
  const marginTop = 40

  return (
    <div>
      {truncated && <ChartNotice>仅显示前 {MAX_CORR_COLUMNS} 个数值列的相关性</ChartNotice>}
      <div className="overflow-auto">
        <svg
          aria-label={`${method} 相关矩阵，共 ${labels.length} 个数值列`}
          role="img"
          width={marginLeft + size * labels.length}
          height={marginTop + size * labels.length + 50}
          className="mx-auto block"
        >
          <defs>
            <linearGradient id="corrGradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--chart-diverging-negative)" />
              <stop offset="50%" stopColor="var(--chart-diverging-neutral)" />
              <stop offset="100%" stopColor="var(--chart-diverging-positive)" />
            </linearGradient>
          </defs>
          {labels.map((label, index) => <CorrelationLabel key={`x-${label}`} axis="x" label={label} index={index} size={size} marginLeft={marginLeft} marginTop={marginTop} />)}
          {labels.map((label, index) => <CorrelationLabel key={`y-${label}`} axis="y" label={label} index={index} size={size} marginLeft={marginLeft} marginTop={marginTop} />)}
          {cells.map((row, rowIndex) => row.map((cell, columnIndex) => {
            const value = cell.value
            const strength = value === null ? 0 : Math.round(Math.min(1, Math.abs(value)) * 100)
            const endpoint = value !== null && value < 0 ? "var(--chart-diverging-negative)" : "var(--chart-diverging-positive)"
            const fill = value === null
              ? "var(--chart-missing)"
              : `color-mix(in srgb, var(--chart-diverging-neutral) ${100 - strength}%, ${endpoint})`
            return (
              <g key={`${rowIndex}-${columnIndex}`}>
                <title>{`${labels[rowIndex]} / ${labels[columnIndex]}: ${value === null ? "不可计算" : value.toFixed(4)}，n=${cell.sampleSize}`}</title>
                <rect x={marginLeft + columnIndex * size + 1} y={marginTop + rowIndex * size + 1} width={size - 2} height={size - 2} fill={fill} rx={3} />
                <text x={marginLeft + columnIndex * size + size / 2} y={marginTop + rowIndex * size + size / 2 + 1} textAnchor="middle" fontSize={9} fill={value !== null && Math.abs(value) > 0.5 ? "var(--chart-cell-text-strong)" : "var(--chart-cell-text-muted)"}>
                  {value === null ? "-" : value.toFixed(2)}
                </text>
                <text x={marginLeft + columnIndex * size + size / 2} y={marginTop + rowIndex * size + size / 2 + 11} textAnchor="middle" fontSize={7} fill="var(--chart-cell-text-muted)">n={cell.sampleSize}</text>
              </g>
            )
          }))}
          <rect x={marginLeft} y={marginTop + labels.length * size + 10} width={size * labels.length} height={12} fill="url(#corrGradient)" rx={3} />
          <text x={marginLeft} y={marginTop + labels.length * size + 34} fontSize={9} fill="var(--chart-tick)">-1.0</text>
          <text x={marginLeft + size * labels.length} y={marginTop + labels.length * size + 34} textAnchor="end" fontSize={9} fill="var(--chart-tick)">+1.0</text>
          <text x={marginLeft + size * labels.length / 2} y={marginTop + labels.length * size + 34} textAnchor="middle" fontSize={9} fill="var(--chart-tick)">0</text>
        </svg>
      </div>
    </div>
  )
})

function CorrelationLabel({ axis, label, index, size, marginLeft, marginTop }: {
  axis: "x" | "y"
  label: string
  index: number
  size: number
  marginLeft: number
  marginTop: number
}) {
  return axis === "x" ? (
    <text x={marginLeft + index * size + size / 2} y={marginTop - 8} textAnchor="start" fontSize={10} fill="var(--chart-tick)" transform={`rotate(-40, ${marginLeft + index * size + size / 2}, ${marginTop - 8})`}>{label}</text>
  ) : (
    <text x={marginLeft - 5} y={marginTop + index * size + size / 2 + 4} textAnchor="end" fontSize={10} fill="var(--chart-tick)">{label}</text>
  )
}
