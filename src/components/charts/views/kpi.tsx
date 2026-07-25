"use client"

import React from "react"
import { formatNumber } from "../utils"

export const KpiView = React.memo(function KpiView({ data, valueKey, labelKey, comparisonKey }: { data: Record<string, unknown>[]; valueKey: string; labelKey?: string; comparisonKey?: string }) {
  const row = data[0]
  const value = Number(row?.[valueKey])
  const comparison = comparisonKey ? Number(row?.[comparisonKey]) : Number.NaN
  const delta = Number.isFinite(value) && Number.isFinite(comparison) && comparison !== 0 ? (value - comparison) / Math.abs(comparison) : Number.NaN
  return (
    <section className="flex min-h-[180px] flex-col justify-center px-6 py-7" aria-label={labelKey ? String(row?.[labelKey] ?? valueKey) : valueKey}>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{labelKey ? String(row?.[labelKey] ?? valueKey) : valueKey}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-[var(--foreground)]">{Number.isFinite(value) ? formatNumber(value) : "-"}</p>
      {Number.isFinite(delta) && <p className={`mt-2 text-xs font-medium ${delta >= 0 ? "text-[var(--success)]" : "text-[var(--destructive)]"}`}>{delta >= 0 ? "↑" : "↓"} {Math.abs(delta * 100).toFixed(1)}% 对比</p>}
    </section>
  )
})
