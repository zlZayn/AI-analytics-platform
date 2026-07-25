"use client"

import React, { useMemo } from "react"
import { MAX_HEATMAP_ENTRIES } from "../constants"
import { EmptyState } from "../empty-state"

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

  const { matrix, xLabels, yLabels, truncated } = useMemo(() => {
    const xSet = new Set<string>()
    const ySet = new Set<string>()
    data.forEach((d) => {
      xSet.add(String(d[xKey] ?? ""))
      ySet.add(String(d[yKey] ?? ""))
    })

    const xLabels = Array.from(xSet).slice(0, MAX_HEATMAP_ENTRIES)
    const yLabels = Array.from(ySet).slice(0, MAX_HEATMAP_ENTRIES)
    const truncated =
      xSet.size > MAX_HEATMAP_ENTRIES || ySet.size > MAX_HEATMAP_ENTRIES

    // Build index for O(1) lookup
    const index = new Map<string, unknown>()
    for (const d of data) {
      const key = String(d[xKey]) + "|" + String(d[yKey])
      index.set(key, d[valueKey])
    }

    const matrix = yLabels.map((yVal) =>
      xLabels.map((xVal) => {
        const val = index.get(xVal + "|" + yVal)
        return val !== undefined ? Number(val) : 0
      }),
    )

    return { matrix, xLabels, yLabels, truncated }
  }, [data, xKey, yKey, valueKey])

  if (matrix.length === 0) return <EmptyState />

  const allValues = matrix.flat()
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range = maxVal - minVal || 1

  const cellW = Math.max(40, Math.min(60, 600 / xLabels.length))
  const cellH = 32
  const marginLeft = 80
  const marginTop = 20

  return (
    <div>
      {truncated && (
        <div className="mb-2 rounded border border-[var(--warning-border)] bg-[var(--warning-surface)] px-3 py-1.5 text-xs text-[var(--warning)]">
          数据已截断: 仅显示前 {MAX_HEATMAP_ENTRIES} 个唯一值
        </div>
      )}
      <div className="overflow-auto">
        <svg
          width={marginLeft + cellW * xLabels.length}
          height={marginTop + cellH * yLabels.length + 10}
          style={{ display: "block" }}
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
                const norm = (val - minVal) / range
                const color = `color-mix(in srgb, var(--chart-sequential-low) ${Math.round((1 - norm) * 100)}%, var(--chart-sequential-high))`
                return (
                  <g key={col}>
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
                      fill={norm > 0.6 ? "var(--chart-cell-text-strong)" : "var(--chart-cell-text-muted)"}
                    >
                      {typeof val === "number" ? val.toFixed(0) : String(val)}
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
