"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, Play, Loader2, FlaskConical } from "lucide-react"
import type { InsightItem } from "@/lib/ai-contract"
import { useWebR } from "@/hooks/useWebR"
import {
  buildStatTestCode,
  parseStatTestOutput,
  summarizeStatTest,
  type StatTestResult,
} from "@/lib/r-stats"
import type { SemanticDataset } from "@/types/session"

export type { InsightItem } from "@/lib/ai-contract"

interface InsightCardProps {
  index: number
  item: InsightItem
  /** 该洞察对应的 SQL（querySpec 项为编译产物；回退项为 AI 原文）。缺省表示尚未生成 */
  sql?: string | null
  onExecute: (sql: string, chart: InsightItem["chart"]) => void
  loading?: boolean
  /** 执行失败时的错误信息（阶段四：卡片级错误展示） */
  error?: string | null
  /** 当前结果（黑盒统计检验的数据源；缺省不渲染统计区块） */
  result?: SemanticDataset | null
}

export function InsightCard({ index, item, sql, onExecute, loading, error, result }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false)
  const sqlText = sql ?? item.sql ?? ""
  const webR = useWebR()
  const [statOutcome, setStatOutcome] = useState<{ result?: StatTestResult | undefined; message?: string | undefined }>({})
  // 派生 loading：有 statTest 且结果就绪但尚无结果/错误（状态只在异步链中写入）
  const statRunning = !!item.statTest && !!result && !statOutcome.result && !statOutcome.message

  // 黑盒统计（蓝图阶段 3）：item.statTest + result 就绪时静默执行固定模板；
  // 先确保 WebR 初始化（失败 → 卡片内提示，读卡不受影响）；状态写入全部在异步链中
  useEffect(() => {
    if (!item.statTest || !result) return
    const statTest = item.statTest
    let cancelled = false
    void (async () => {
      try {
        const code = buildStatTestCode(result, statTest)
        await webR.init()
        if (cancelled) return
        const stdout = await webR.runStats(code)
        if (cancelled) return
        const parsed = parseStatTestOutput(stdout, statTest.kind)
        setStatOutcome({
          result: parsed ?? undefined,
          message: parsed ? undefined : "统计检验无输出",
        })
      } catch (e) {
        if (!cancelled) {
          setStatOutcome({ message: e instanceof Error ? e.message : "统计检验失败" })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [item.statTest, item.statTest?.kind, result, webR])

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
        {item.notice && <p className="mt-1 text-[11px] text-[var(--warning)]">{item.notice}</p>}
      </div>

      {/* 统计检验（黑盒 WebR，本地执行） */}
      {item.statTest && (
        <div className="px-3 pb-2">
          <div className="rounded border border-[var(--border)] bg-[var(--muted)] px-2 py-1.5 text-[11px]">
            <div className="font-medium text-[var(--foreground)] flex items-center gap-1">
              <FlaskConical className="w-3 h-3" /> 统计检验
            </div>
            <div className="text-[var(--muted-foreground)] mt-0.5">{item.statTest.hypothesis}</div>
            {statRunning && (
              <div className="flex items-center gap-1 text-[var(--muted-foreground)] mt-0.5">
                <Loader2 className="w-3 h-3 animate-spin" /> 浏览器本地计算中（WebR）…
              </div>
            )}
            {statOutcome.result && (
              <div className="mt-0.5 font-medium text-[var(--foreground)]">
                {summarizeStatTest(statOutcome.result)}
              </div>
            )}
            {statOutcome.message && (
              <div className="mt-0.5 text-[var(--warning)]">{statOutcome.message}</div>
            )}
          </div>
        </div>
      )}

      {/* 执行错误（卡片级） */}
      {error && (
        <div className="px-3 pb-2">
          <div className="rounded border border-[var(--destructive-border)] bg-[var(--destructive-surface)] px-2 py-1.5 text-[11px] text-[var(--destructive)]">
            {error}
          </div>
        </div>
      )}

      {/* SQL 与映射（展开查看） */}
      {expanded && (
        <div className="border-t bg-[var(--muted)] px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-medium tracking-wide text-[var(--muted-foreground)]">SQL</span>
            {sqlText ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 text-[10px] text-[var(--muted-foreground)]"
                onClick={() => void navigator.clipboard.writeText(sqlText)}
              >
                复制 SQL
              </Button>
            ) : (
              <span className="text-[9px] text-[var(--muted-foreground)]">执行后生成</span>
            )}
          </div>
          {sqlText ? (
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-[var(--border)] bg-[var(--card)] p-2 font-mono text-[10px] leading-relaxed text-[var(--foreground)]">
              {sqlText}
            </pre>
          ) : (
            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
              该洞察按结构化查询自动生成 SQL；点击「执行」后在这里显示。
            </p>
          )}
          <div className="mt-1.5 text-[9px] text-[var(--muted-foreground)]">
            图表: {item.chart.chartType} | 映射: {Object.entries(item.chart).filter(([key]) => key !== "chartType").map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("/") : value}`).join(", ") || "无"}
          </div>
        </div>
      )}
    </div>
  )
}