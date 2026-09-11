"use client"

// 统一历史时间线：把后端 SQL 历史与前端 AI/R 历史（lib/history-merge.ts 合并）渲染成一条列表。
// 每条按 kind 显示来源徽标与可用动作：
// - SQL / R（有来源 SQL）/ AI（有可执行回退 SQL）→「打开」带回工作台执行
// - 有代码块（SQL / R）→「复制代码」；AI →「复制问题」
// 组件只渲染与回调，不取数、不合并（数据与合并归页面与 lib/history-merge.ts）。

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TimelineItem } from "@/lib/history-merge"
import { Play, Copy } from "lucide-react"

const KIND_LABEL: Record<TimelineItem["kind"], string> = { sql: "SQL", ai: "AI", r: "R" }

function formatTime(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ""
  return new Date(ms).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

interface HistoryTimelineProps {
  items: TimelineItem[]
  onOpen: (item: TimelineItem) => void
  onCopy: (text: string) => void
}

export function HistoryTimeline({ items, onOpen, onCopy }: HistoryTimelineProps) {
  if (items.length === 0) {
    return <p className="text-xs text-[var(--muted-foreground)] py-8 text-center">暂无历史</p>
  }
  return (
    <div className="space-y-2">
      {items.map((item) => {
        return (
          <div key={item.key} className="group border rounded-md p-3 hover:border-[var(--border)] transition-colors">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-auto">
                  {KIND_LABEL[item.kind]}
                </Badge>
                <Badge variant={item.ok ? "default" : "destructive"} className="text-[9px] px-1 py-0 h-auto">
                  {item.ok ? "OK" : "ERR"}
                </Badge>
                {item.kind === "sql" && (
                  <>
                    <span className="text-[10px] text-[var(--muted-foreground)]">{item.rowCount} 行</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">{item.executionTimeMs}ms</span>
                  </>
                )}
                <span className="truncate text-[10px] text-[var(--muted-foreground)]">{formatTime(item.createdAt)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {item.openSql && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onOpen(item)} title="执行">
                    <Play className="w-3 h-3" />
                  </Button>
                )}
                {item.copyText && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onCopy(item.copyText)} title={item.kind === "ai" ? "复制问题" : "复制"}>
                    <Copy className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            {/* AI 无代码块：问题即标题；SQL/R 的代码块已含内容，不再重复标题 */}
            {!item.code && <p className="mb-1.5 text-xs font-medium text-[var(--foreground)] line-clamp-2">{item.title}</p>}
            {item.note && <p className="mb-1.5 text-[11px] text-[var(--muted-foreground)] line-clamp-2">{item.note}</p>}
            {item.code && (
              <pre className="text-[10px] text-[var(--muted-foreground)] font-mono whitespace-pre-wrap break-all leading-relaxed bg-[var(--muted)] rounded p-2 max-h-32 overflow-auto">
                {item.code}
              </pre>
            )}
          </div>
        )
      })}
    </div>
  )
}
