"use client"

import React, { useMemo, useRef } from "react"
import { useContainerWidth } from "../hooks/use-container-width"
import { getColor, formatNumber } from "../utils"
import { computeBoxStats } from "../algorithms"
import { EmptyState } from "../empty-state"

export const BoxPlotView = React.memo(function BoxPlotView({
  data,
  xKey,
  yKey,
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useContainerWidth(containerRef)

  const groups = useMemo(() => {
    const map = new Map<string, number[]>()
    data.forEach((d) => {
      const key = String(d[xKey] ?? "")
      const val = Number(d[yKey])
      if (!isNaN(val)) {
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(val)
      }
    })
    return Array.from(map.entries())
      .map(([name, values]) => ({
        name,
        stats: computeBoxStats(values),
        count: values.length,
      }))
      .filter((g) => g.stats !== null)
  }, [data, xKey, yKey])

  if (groups.length === 0) return <EmptyState />

  const height = 320
  const margin = { top: 30, right: 20, bottom: 50, left: 60 }
  const plotH = height - margin.top - margin.bottom

  const allValues = data.map((d) => Number(d[yKey])).filter((v) => !isNaN(v))
  const globalMin = Math.min(...allValues)
  const globalMax = Math.max(...allValues)
  const yPad = (globalMax - globalMin) * 0.1 || 1

  const yScale = (v: number) => {
    return (
      plotH -
      ((v - (globalMin - yPad)) / ((globalMax + yPad) - (globalMin - yPad))) *
        plotH
    )
  }

  const plotW = width - margin.left - margin.right
  const groupWidth = plotW / groups.length
  const boxWidth = Math.min(groupWidth * 0.6, 60)

  const tickCount = 6
  const tickStep = ((globalMax + yPad) - (globalMin - yPad)) / tickCount
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    globalMin - yPad + i * tickStep,
  )

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={height} style={{ display: "block" }}>
        {yTicks.map((tick, i) => {
          const y = margin.top + yScale(tick)
          return (
            <g key={i}>
              <line
                x1={margin.left}
                y1={y}
                x2={width - margin.right}
                y2={y}
                stroke="#f0f0f0"
                strokeDasharray="3 3"
              />
              <text
                x={margin.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="#6b7280"
              >
                {formatNumber(tick)}
              </text>
            </g>
          )
        })}

        {groups.map((g, i) => {
          if (!g.stats) return null
          const { stats } = g
          const cx = margin.left + groupWidth * i + groupWidth / 2
          const bx = cx - boxWidth / 2

          return (
            <g key={g.name}>
              <line
                x1={cx}
                y1={margin.top + yScale(stats.whiskerHigh)}
                x2={cx}
                y2={margin.top + yScale(stats.whiskerLow)}
                stroke="#94a3b8"
                strokeWidth={1}
              />
              <line
                x1={cx - boxWidth * 0.3}
                y1={margin.top + yScale(stats.whiskerHigh)}
                x2={cx + boxWidth * 0.3}
                y2={margin.top + yScale(stats.whiskerHigh)}
                stroke="#94a3b8"
                strokeWidth={1}
              />
              <line
                x1={cx - boxWidth * 0.3}
                y1={margin.top + yScale(stats.whiskerLow)}
                x2={cx + boxWidth * 0.3}
                y2={margin.top + yScale(stats.whiskerLow)}
                stroke="#94a3b8"
                strokeWidth={1}
              />
              <rect
                x={bx}
                y={margin.top + yScale(stats.q3)}
                width={boxWidth}
                height={yScale(stats.q1) - yScale(stats.q3)}
                fill={getColor(i)}
                fillOpacity={0.3}
                stroke={getColor(i)}
                strokeWidth={1.5}
                rx={3}
              />
              <line
                x1={bx}
                y1={margin.top + yScale(stats.median)}
                x2={bx + boxWidth}
                y2={margin.top + yScale(stats.median)}
                stroke={getColor(i)}
                strokeWidth={2}
              />
              {stats.outliers.map((o, j) => (
                <circle
                  key={j}
                  cx={cx}
                  cy={margin.top + yScale(o)}
                  r={3}
                  fill="none"
                  stroke={getColor(i)}
                  strokeWidth={1.5}
                />
              ))}
              <text
                x={cx}
                y={height - margin.bottom + 18}
                textAnchor="middle"
                fontSize={11}
                fill="#6b7280"
              >
                {g.name.length > 10 ? g.name.slice(0, 10) + "..." : g.name}
              </text>
              <text
                x={cx}
                y={height - margin.bottom + 32}
                textAnchor="middle"
                fontSize={9}
                fill="#9ca3af"
              >
                n={g.count}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
})
