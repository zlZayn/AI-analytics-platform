"use client"

import React, { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { computeHistogram } from "../algorithms"
import { formatNumber } from "../utils"

export const HistogramView = React.memo(function HistogramView({ data, valueKey }: { data: Record<string, unknown>[]; valueKey: string }) {
  const histogram = useMemo(() => computeHistogram(data.map((row) => row[valueKey])), [data, valueKey])
  const chartData = histogram.bins.map((bin) => ({ label: `${formatNumber(bin.start)} - ${formatNumber(bin.end)}`, count: bin.count }))
  if (!chartData.length) return <div className="flex h-[280px] items-center justify-center text-xs text-[var(--muted-foreground)]">没有可绘制的数值</div>
  return (
    <div className="w-full" aria-label={`直方图，共 ${histogram.sampleSize} 个有效值`}>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 54, left: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="label" angle={-35} textAnchor="end" interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} tick={{ fill: "var(--chart-tick)", fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--chart-tick)", fontSize: 10 }} />
          <Tooltip formatter={(value: unknown) => [formatNumber(value), "数量"]} />
          <Bar dataKey="count" fill="var(--chart-accent)" radius={[3, 3, 0, 0]} maxBarSize={42} />
        </BarChart>
      </ResponsiveContainer>
      <p className="px-3 pb-2 text-[10px] text-[var(--muted-foreground)]">{histogram.method === "freedman-diaconis" ? "Freedman–Diaconis" : "Sturges"} 分箱 · {histogram.sampleSize} 个有效值{histogram.invalidCount ? ` · 忽略 ${histogram.invalidCount} 个无效值` : ""}</p>
    </div>
  )
})
