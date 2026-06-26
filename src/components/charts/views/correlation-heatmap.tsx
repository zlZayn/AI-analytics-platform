"use client"

import React, { useMemo } from "react"
import { MAX_CORR_COLUMNS, MAX_CORR_ROWS } from "../constants"
import { computeCorrelation } from "../utils"
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
        matrix[i][j] = Math.round(corr * 100) / 100
        matrix[j][i] = matrix[i][j]
      }
    }
    return { matrix, labels, truncated }
  }, [data, method])

  if (labels.length === 0) return <EmptyState />

  const size = Math.max(32, Math.min(60, 500 / labels.length))
  const marginLeft = 80
  const marginTop = 40

  // 正相关蓝色，负相关红色，0 白色
  const valueToColor = (v: number) => {
    if (v >= 0) {
      const t = v
      return `rgb(${Math.round(255 - 216 * t)},${Math.round(255 - 132 * t)},${Math.round(255 - 10 * t)})`
    }
    const t = -v
    return `rgb(${Math.round(255 - 218 * t)},${Math.round(255 - 156 * t)},${Math.round(255 - 246 * t)})`
  }

  return (
    <div>
      {truncated && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-2">
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
              <stop offset="0%" stopColor="rgb(37,99,9)" />
              <stop offset="50%" stopColor="rgb(255,255,255)" />
              <stop offset="100%" stopColor="rgb(37,99,246)" />
            </linearGradient>
          </defs>

          {labels.map((label, i) => (
            <text
              key={`x-${i}`}
              x={marginLeft + i * size + size / 2}
              y={marginTop - 8}
              textAnchor="start"
              fontSize={10}
              fill="#6b7280"
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
              fill="#6b7280"
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
                  fill={Math.abs(val) > 0.5 ? "#fff" : "#374151"}
                >
                  {val.toFixed(2)}
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
            fill="#6b7280"
          >
            -1.0
          </text>
          <text
            x={marginLeft + size * labels.length}
            y={marginTop + labels.length * size + 34}
            textAnchor="end"
            fontSize={9}
            fill="#6b7280"
          >
            +1.0
          </text>
          <text
            x={marginLeft + (size * labels.length) / 2}
            y={marginTop + labels.length * size + 34}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            0
          </text>
        </svg>
      </div>
    </div>
  )
})
