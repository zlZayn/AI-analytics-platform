"use client"

// 会话视图（阶段四扩展：三层视图化）
// 按 session.status 展示 loading / error；结果区为 Tabs（洞察 / 探索 / 明细）：
// - 洞察：AI 多结果卡片流（InsightCard，结论前置，默认激活）
// - 探索：ResultPanel（图表配置 + 渲染，AI 预配映射，用户微调）
// - 明细：table-view 虚拟滚动数据表（复用图表系统的 table 分发）
// 数据经 render-binder 适配后交给 ResultPanel；warnings/adjustments 呈现于探索视图。

import { useMemo, useState } from "react"
import type { AnalysisSession } from "@/types/session"
import type { ChartMapping } from "@/components/chart"
import { Chart } from "@/components/chart"
import { bindDataToChart } from "@/lib/render-binder"
import { ResultPanel } from "@/components/dashboard/result-panel"
import { ChartNotice } from "@/components/charts/chart-notice"
import { Loader2, Pencil } from "lucide-react"
import { ResultToolbar } from "@/components/result-toolbar"
import { RWorkbench } from "@/components/r-workbench"
import { InsightCard, type InsightItem } from "@/components/insight-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface SessionViewProps {
  session: AnalysisSession
  onMappingChange: (mapping: ChartMapping) => void
  onCopySql: () => void
  /** AI 多洞察（会话外临时状态，不进 AnalysisSession） */
  insights?: InsightItem[]
  /** 正在执行的洞察卡片索引（卡片 loading 态） */
  executingInsightIndex?: number | null
  /** 洞察卡片级错误（当前执行卡片的失败信息） */
  insightError?: string | null
  /** 执行第 index 条洞察（父组件 dispatch 编译/执行管线） */
  onExecuteInsight?: (index: number) => void
  /** 受控当前 Tab（可选；不传时内部自管） */
  tab?: string
  onTabChange?: (tab: string) => void
}

export function SessionView({
  session,
  onMappingChange,
  onCopySql,
  insights = [],
  executingInsightIndex = null,
  insightError = null,
  onExecuteInsight,
  tab: tabProp,
  onTabChange,
}: SessionViewProps) {
  const { status, result, displayConfig, isUserModified } = session
  const busy = status === "compiling" || status === "executing"
  // R 工作台开关：局部状态，不进 sessionReducer（R 输出是会话外临时状态）
  const [rWorkbenchOpen, setRWorkbenchOpen] = useState(false)
  const hasInsights = insights.length > 0
  const [tabInternal, setTabInternal] = useState<string>(hasInsights ? "insights" : "explore")
  const tab = tabProp ?? tabInternal
  const changeTab = (value: string) => {
    onTabChange?.(value)
    setTabInternal(value)
  }

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
    <div className="min-h-0 flex flex-col rounded-lg border overflow-hidden">
      {/* 头部条：标题 + 导出下拉 + 手动调整徽标 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)] shrink-0">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">分析结果</span>
        <div className="flex items-center gap-2">
          <ResultToolbar dataset={result} onOpenRWorkbench={() => setRWorkbenchOpen(true)} />
          {isUserModified && (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--warning)] bg-[var(--warning-surface)]">
              <Pencil className="w-2.5 h-2.5" /> 已手动调整
            </span>
          )}
        </div>
      </div>

      {/* 三层视图：洞察 / 探索 / 明细 */}
      <Tabs value={tab} onValueChange={(v) => changeTab(String(v))} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="px-3 pt-2 shrink-0">
          <TabsList variant="line">
            {hasInsights && <TabsTrigger value="insights">洞察 {insights.length}</TabsTrigger>}
            <TabsTrigger value="explore">探索</TabsTrigger>
            <TabsTrigger value="data">明细</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="insights" keepMounted className="min-h-0 flex-1 overflow-auto p-3">
          <div className="space-y-2">
            {insights.map((item, i) => (
              <InsightCard
                key={`${item.title}-${i}`}
                index={i}
                item={item}
                onExecute={() => {
                  changeTab("explore")
                  onExecuteInsight?.(i)
                }}
                loading={executingInsightIndex === i}
                error={executingInsightIndex === i ? insightError : null}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="explore" keepMounted className="min-h-0 flex-1 overflow-auto p-3 space-y-2">
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
        </TabsContent>

        <TabsContent value="data" keepMounted className="min-h-0 flex-1 overflow-auto p-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <Chart mapping={{ chartType: "table" }} data={bound.rows} />
          </div>
        </TabsContent>
      </Tabs>

      {/* R 分析工作台：结果区底部（导出菜单「R 分析」打开，不改变结果区布局） */}
      <RWorkbench
        dataset={result}
        open={rWorkbenchOpen}
        onClose={() => setRWorkbenchOpen(false)}
      />
    </div>
  )
}