"use client"

import React, { useMemo } from "react"
import { MAX_HEATMAP_ENTRIES } from "../constants"
import { EmptyState } from "../empty-state"
import { buildHeatmap } from "../transform"
import { ChartNotice } from "../chart-notice"

export const HeatmapView = React.memo(function HeatmapView({
  data,
  xKey,
  yKey,
  fillKey,
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  fillKey?: string
}) {
  const valueKey = fillKey || yKey

  const transformed = useMemo(
    () => buildHeatmap(data, xKey, yKey, valueKey, MAX_HEATMAP_ENTRIES),
    [data, xKey, yKey, valueKey],
  )

  if (!transformed.ok) return <EmptyState message={transformed.message} />
  const { matrix, xLabels, yLabels, truncated, min: minVal, max: maxVal, scale } = transformed
  if (matrix.length === 0) return <EmptyState />

  const range = scale === "diverging" ? Math.max(Math.abs(minVal), Math.abs(maxVal)) || 1 : maxVal - minVal || 1

  const cellW = Math.max(40, Math.min(60, 600 / xLabels.length))
  const cellH = 32
  const marginLeft = 80
  const marginTop = 20

  return (
    <div>
      {truncated && (
        <ChartNotice>
          数据已截断: 仅显示前 {MAX_HEATMAP_ENTRIES} 个唯一值
        </ChartNotice>
      )}
      <div className="overflow-auto">
        <svg
          width={marginLeft + cellW * xLabels.length}
          height={marginTop + cellH * yLabels.length + 10}
          className="mx-auto block"
        >
          {xLabels.map((x, i) => (
            <text
              key={i}
              x={marginLeft + i * cellW + cellW / 2}
              y={marginTop - 5}
              textAnchor="middle"
              fontSize={10}
              fill="var(--chart-tick)"
              transform={`rotate(-30, ${marginLeft + i * cellW + cellW / 2}, ${marginTop - 5})`}
            >
              {x.length > 8 ? x.slice(0, 8) + ".." : x}
            </text>
          ))}
          {yLabels.map((y, row) => (
            <g key={row}>
              <text
                x={marginLeft - 5}
                y={marginTop + row * cellH + cellH / 2 + 4}
                textAnchor="end"
                fontSize={10}
                fill="var(--chart-tick)"
              >
                {y.length > 12 ? y.slice(0, 12) + ".." : y}
              </text>
              {xLabels.map((_, col) => {
                const val = matrix[row][col]
                const norm = val === null ? 0 : scale === "diverging" ? (val / range + 1) / 2 : (val - minVal) / range
                const intensity = val === null ? 0 : scale === "diverging" ? Math.abs(val) / range : norm
                const color = val === null
                  ? "var(--chart-missing)"
                  : scale === "diverging"
                    ? `color-mix(in srgb, var(--chart-diverging-neutral) ${Math.round((1 - Math.abs(val) / range) * 100)}%, ${val < 0 ? "var(--chart-diverging-negative)" : "var(--chart-diverging-positive)"})`
                    : `color-mix(in srgb, var(--chart-sequential-low) ${Math.round((1 - norm) * 100)}%, var(--chart-sequential-high))`
                return (
                  <g key={col}>
                    <title>{`${xLabels[col]} / ${y}: ${val === null ? "缺失" : val}`}</title>
                    <rect
                      x={marginLeft + col * cellW + 1}
                      y={marginTop + row * cellH + 1}
                      width={cellW - 2}
                      height={cellH - 2}
                      fill={color}
                      rx={3}
                    />
                    <text
                      x={marginLeft + col * cellW + cellW / 2}
                      y={marginTop + row * cellH + cellH / 2 + 3}
                      textAnchor="middle"
                      fontSize={9}
                      fill={intensity > 0.6 ? "var(--chart-cell-text-strong)" : "var(--chart-cell-text-muted)"}
                    >
                      {val === null ? "缺失" : val.toFixed(0)}
                    </text>
                  </g>
                )
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
})
