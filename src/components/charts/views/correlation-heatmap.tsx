"use client"

import React, { useMemo } from "react"
import { MAX_CORR_COLUMNS, MAX_CORR_ROWS } from "../constants"
import { computeCorrelation } from "../algorithms"
import { EmptyState } from "../empty-state"

export const CorrelationHeatmap = React.memo(function CorrelationHeatmap({
  data,
  method = "pearson",
}: {
  data: Record<string, unknown>[]
  method?: string
}) {
  const { matrix, labels, truncated } = useMemo(() => {
    const numericColumns = Object.keys(data[0] || {}).filter((key) => {
      const vals = data.slice(0, 20).map((d) => d[key])
      return vals.some(
        (v) => v !== null && v !== undefined && !isNaN(Number(v)),
      )
    })

    const labels = numericColumns.slice(0, MAX_CORR_COLUMNS)
    const truncated = numericColumns.length > MAX_CORR_COLUMNS
    const sample = data.slice(0, MAX_CORR_ROWS)
    const n = labels.length

    // 提取各列数值
    const columnData = labels.map((col) =>
      sample.map((d) => Number(d[col]))
    )

    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1
          continue
        }
        // 联合过滤 NaN，保持行对齐
        const xArr: number[] = []
        const yArr: number[] = []
        for (let k = 0; k < columnData[i].length; k++) {
          if (!isNaN(columnData[i][k]) && !isNaN(columnData[j][k])) {
            xArr.push(columnData[i][k])
            yArr.push(columnData[j][k])
          }
        }
        const corr = computeCorrelation(xArr, yArr, method)
        matrix[i][j] = corr.value === null ? Number.NaN : Math.round(corr.value * 100) / 100
        matrix[j][i] = matrix[i][j]
      }
    }
    return { matrix, labels, truncated }
  }, [data, method])

  if (labels.length === 0) return <EmptyState />

  const size = Math.max(32, Math.min(60, 500 / labels.length))
  const marginLeft = 80
  const marginTop = 40

  // Correlation colors use theme tokens so the neutral midpoint remains readable.
  const valueToColor = (v: number) => {
    const strength = Math.round(Math.min(1, Math.abs(v)) * 100)
    const endpoint = v >= 0 ? "var(--chart-diverging-positive)" : "var(--chart-diverging-negative)"
    return `color-mix(in srgb, var(--chart-diverging-neutral) ${100 - strength}%, ${endpoint})`
  }

  return (
    <div>
      {truncated && (
        <div className="mb-2 rounded border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-1.5 text-xs text-[var(--warning)]">
          仅显示前 {MAX_CORR_COLUMNS} 个数值列的相关性
        </div>
      )}
      <div className="overflow-auto">
        <svg
          width={marginLeft + size * labels.length}
          height={marginTop + size * labels.length + 50}
          style={{ display: "block" }}
        >
          <defs>
            <linearGradient id="corrGradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--chart-diverging-negative)" />
              <stop offset="50%" stopColor="var(--chart-diverging-neutral)" />
              <stop offset="100%" stopColor="var(--chart-diverging-positive)" />
            </linearGradient>
          </defs>

          {labels.map((label, i) => (
            <text
              key={`x-${i}`}
              x={marginLeft + i * size + size / 2}
              y={marginTop - 8}
              textAnchor="start"
              fontSize={10}
              fill="var(--chart-tick)"
              transform={`rotate(-40, ${marginLeft + i * size + size / 2}, ${marginTop - 8})`}
            >
              {label}
            </text>
          ))}
          {labels.map((label, i) => (
            <text
              key={`y-${i}`}
              x={marginLeft - 5}
              y={marginTop + i * size + size / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--chart-tick)"
            >
              {label}
            </text>
          ))}
          {matrix.map((row, i) =>
            row.map((val, j) => (
              <g key={`${i}-${j}`}>
                <rect
                  x={marginLeft + j * size + 1}
                  y={marginTop + i * size + 1}
                  width={size - 2}
                  height={size - 2}
                  fill={valueToColor(val)}
                  rx={3}
                />
                <text
                  x={marginLeft + j * size + size / 2}
                  y={marginTop + i * size + size / 2 + 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill={Math.abs(val) > 0.5 ? "var(--chart-cell-text-strong)" : "var(--chart-cell-text-muted)"}
                >
                  {Number.isFinite(val) ? val.toFixed(2) : "-"}
                </text>
              </g>
            )),
          )}
          <rect
            x={marginLeft}
            y={marginTop + labels.length * size + 10}
            width={size * labels.length}
            height={12}
            fill="url(#corrGradient)"
            rx={3}
          />
          <text
            x={marginLeft}
            y={marginTop + labels.length * size + 34}
            fontSize={9}
            fill="var(--chart-tick)"
          >
            -1.0
          </text>
          <text
            x={marginLeft + size * labels.length}
            y={marginTop + labels.length * size + 34}
            textAnchor="end"
            fontSize={9}
            fill="var(--chart-tick)"
          >
            +1.0
          </text>
          <text
            x={marginLeft + (size * labels.length) / 2}
            y={marginTop + labels.length * size + 34}
            textAnchor="middle"
            fontSize={9}
            fill="var(--chart-tick)"
          >
            0
          </text>
        </svg>
      </div>
    </div>
  )
})
