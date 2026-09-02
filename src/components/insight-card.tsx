"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Play, Loader2 } from "lucide-react"
import type { InsightItem } from "@/lib/ai-contract"

export type { InsightItem } from "@/lib/ai-contract"

interface InsightCardProps {
  index: number
  item: InsightItem
  onExecute: (sql: string, chart: InsightItem["chart"]) => void
  loading?: boolean
  /** 执行失败时的错误信息（阶段四：卡片级错误展示） */
  error?: string | null
}

export function InsightCard({ index, item, onExecute, loading, error }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg overflow-hidden bg-[var(--card)] hover:border-[var(--ring)] transition-colors">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-[var(--muted-foreground)] shrink-0">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-xs font-medium truncate">{item.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-[var(--accent)] transition-colors cursor-pointer"
            title="查看 SQL"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[var(--muted-foreground)]" />
            )}
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-[10px] text-[var(--muted-foreground)]"
            onClick={() => onExecute(item.sql ?? "", item.chart)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            执行
          </Button>
        </div>
      </div>

      {/* 洞察说明 */}
      <div className="px-3 pb-2">
        <p className="text-[11px] text-[var(--muted-foreground)]">{item.insight}</p>
      </div>

      {/* 执行错误（卡片级） */}
      {error && (
        <div className="px-3 pb-2">
          <div className="rounded border border-[var(--destructive-border)] bg-[var(--destructive-surface)] px-2 py-1.5 text-[11px] text-[var(--destructive)]">
            {error}
          </div>
        </div>
      )}

      {/* SQL 展开 */}
      {expanded && (
        <div className="border-t bg-[var(--muted)] px-3 py-2">
          <pre className="text-[10px] font-mono text-[var(--foreground)] whitespace-pre-wrap overflow-x-auto">
            {item.sql ?? ""}
          </pre>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[9px] text-[var(--muted-foreground)]">
              图表: {item.chart.chartType} | 映射: {Object.entries(item.chart).filter(([key]) => key !== "chartType").map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("/") : value}`).join(", ") || "无"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
