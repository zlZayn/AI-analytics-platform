"use client"

// 会话视图（阶段四）
// 根据 session.status 展示 loading / error / 图表；数据经 render-binder 适配后交给 ResultPanel，
// 并把 warnings（数据质量问题）与 adjustments（展示层自动调整）以统一警告样式呈现。

import { useMemo } from "react"
import type { AnalysisSession } from "@/types/session"
import type { ChartMapping } from "@/components/chart"
import { bindDataToChart } from "@/lib/render-binder"
import { ResultPanel } from "@/components/dashboard/result-panel"
import { ChartNotice } from "@/components/charts/chart-notice"
import { Loader2, Pencil } from "lucide-react"

interface SessionViewProps {
  session: AnalysisSession
  onMappingChange: (mapping: ChartMapping) => void
  onCopySql: () => void
}

export function SessionView({ session, onMappingChange, onCopySql }: SessionViewProps) {
  const { status, result, displayConfig, isUserModified } = session
  const busy = status === "compiling" || status === "executing"

  // 渲染绑定：展示层修正（坐标轴交换、无效数值过滤）+ 警告/调整说明
  const bound = useMemo(() => {
    if (!result) return null
    return bindDataToChart(result, displayConfig)
  }, [result, displayConfig])

  if (busy && !result) {
    return (
      <div className="flex items-center justify-center min-h-[200px] rounded-lg border text-xs text-[var(--muted-foreground)]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> 查询执行中...
      </div>
    )
  }

  if (status === "error" && !result) {
    return (
      <div className="min-h-[200px] rounded-lg border border-[var(--destructive-border)] bg-[var(--destructive-surface)] p-3 text-xs text-[var(--destructive)]">
        {session.error || "查询失败"}
      </div>
    )
  }

  if (!result || !bound) return null

  return (
    <div className="min-h-0 overflow-auto rounded-lg border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)]">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">分析结果</span>
        {isUserModified && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--warning)] bg-[var(--warning-surface)]">
            <Pencil className="w-2.5 h-2.5" /> 已手动调整
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {session.validationIssues?.map((issue) => (
          <ChartNotice
            key={`${issue.code}-${issue.field ?? ""}`}
            tone={issue.severity === "error" ? "warning" : "muted"}
          >
            {issue.message}
          </ChartNotice>
        ))}
        {bound.warnings.map((warning) => (
          <ChartNotice key={warning.code} tone="warning">
            {warning.message}
          </ChartNotice>
        ))}
        {bound.adjustments.map((adjustment) => (
          <ChartNotice key={adjustment.code} tone="muted">
            {adjustment.message}
          </ChartNotice>
        ))}
        <ResultPanel
          result={{ ...result, rows: bound.rows }}
          onCopySql={onCopySql}
          mapping={bound.mapping}
          onMappingChange={onMappingChange}
        />
      </div>
    </div>
  )
}
