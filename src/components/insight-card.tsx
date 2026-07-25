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
}

export function InsightCard({ index, item, onExecute, loading }: InsightCardProps) {
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
            onClick={() => onExecute(item.sql, item.chart)}
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

      {/* SQL 展开 */}
      {expanded && (
        <div className="border-t bg-[var(--muted)] px-3 py-2">
          <pre className="text-[10px] font-mono text-[var(--foreground)] whitespace-pre-wrap overflow-x-auto">
            {item.sql}
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

interface InsightPanelProps {
  insights: InsightItem[]
  loading: boolean
  onExecute: (sql: string, chart: InsightItem["chart"]) => void
  onExecuteAll: () => void
  executingIndex: number | null
  onRequestInsights: () => void
}

export function InsightPanel({
  insights,
  loading,
  onExecute,
  onExecuteAll,
  executingIndex,
  onRequestInsights,
}: InsightPanelProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)]">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">AI 洞察推荐</span>
        <div className="flex items-center gap-1.5">
          {insights.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 text-[10px]"
              onClick={onExecuteAll}
              disabled={executingIndex !== null}
            >
              全部执行
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-5 text-[10px]"
            onClick={onRequestInsights}
            disabled={loading}
          >
            {loading ? "生成中..." : "获取洞察"}
          </Button>
        </div>
      </div>

      <div className="p-2 space-y-1.5 max-h-[300px] overflow-auto">
        {insights.length === 0 && !loading && (
          <div className="text-center py-6 text-[var(--muted-foreground)] text-xs">
            点击“获取洞察”生成分析推荐
          </div>
        )}

        {loading && insights.length === 0 && (
          <div className="text-center py-6 text-[var(--muted-foreground)] text-xs">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
            AI 正在分析数据...
          </div>
        )}

        {insights.map((item, i) => (
          <InsightCard
            key={i}
            index={i}
            item={item}
            onExecute={onExecute}
            loading={executingIndex === i}
          />
        ))}
      </div>
    </div>
  )
}
