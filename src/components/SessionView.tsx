"use client"

// 会话视图（阶段四扩展：三层视图化）
// 按 session.status 展示 loading / error；结果区为 Tabs（洞察 / 探索 / 明细）：
// - 洞察：AI 多结果卡片流（InsightCard，结论前置，默认激活）
// - 探索：ResultPanel（图表配置 + 渲染，AI 预配映射，用户微调；表格态为图表引导）
// - 明细：原始查询结果的 table-view 虚拟滚动数据表（填满结果区，不经图表绑定投影）
// 数据经 render-binder 适配后交给 ResultPanel；warnings/adjustments 呈现于探索视图。

import { useEffect, useMemo, useRef, useState } from "react"
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

/** 面板滚动：内容自发滚动（洞察卡片流、探索配置与图表） */
const PANEL_SCROLL = "min-h-0 flex-1 overflow-auto p-3"
/** 面板填充：内容撑满结果区（明细数据表） */
const PANEL_FILL = "min-h-0 flex-1 p-3"

interface SessionViewProps {
  session: AnalysisSession
  onMappingChange: (mapping: ChartMapping) => void
  onCopySql: () => void
  /** 历史作用域键（连接 id）：R 执行历史按此落库，与后端 SQL 历史同轴 */
  connectionId: string | null
  /** 历史回放条目 id（URL `?r=`）：结果就绪后自动打开面板并载入该条代码 */
  replayRId?: string | undefined
  /** AI 多洞察（会话外临时状态，不进 AnalysisSession） */
  insights?: InsightItem[]
  /** 正在执行的洞察卡片索引（卡片 loading 态） */
  executingInsightIndex?: number | null
  /** 当前已载入会话的洞察索引（其 SQL 即会话 compiledSql） */
  activeInsightIndex?: number | null
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
  connectionId,
  replayRId,
  insights = [],
  executingInsightIndex = null,
  activeInsightIndex = null,
  insightError = null,
  onExecuteInsight,
  tab: tabProp,
  onTabChange,
}: SessionViewProps) {
  const { status, result, displayConfig, isUserModified } = session
  const busy = status === "compiling" || status === "executing"
  // R 工作台开关：局部状态，不进 sessionReducer（R 输出是会话外临时状态）
  const [rWorkbenchOpen, setRWorkbenchOpen] = useState(false)
  // 首次打开后保持挂载：关闭只把面板平移出屏，代码与输出不丢（父级决定挂载，子组件不自己记账）
  const [rWorkbenchPinned, setRWorkbenchPinned] = useState(false)
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

  // 历史回放（URL `?r=`）：结果就绪后自动打开面板并载入该条代码；面板内部按 id 取历史，只消费一次
  const replayTriggeredRef = useRef(false)
  useEffect(() => {
    if (!replayRId || !result || replayTriggeredRef.current) return
    replayTriggeredRef.current = true
    setRWorkbenchPinned(true)
    setRWorkbenchOpen(true)
  }, [replayRId, result])

  // 洞察是 AI 输出，独立于查询结果：结果未保留（切页/刷新回来）时仍要能看到卡片
  const hasResult = Boolean(result && bound)
  const showTabs = hasResult || insights.length > 0
  const sql = session.compiledSql?.sql?.trim() || ""
  const statusText = busy
    ? "执行中"
    : status === "error"
      ? "执行失败"
      : result
        ? "已完成"
        : "等待执行"

  return (
    <div className="flex h-full min-h-[360px] flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] lg:min-h-0">
      {/* 头部条：标题、执行状态与结果工具 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)] shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">分析结果</span>
          <span aria-live="polite" className="rounded px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
            {statusText}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <ResultToolbar
              dataset={result}
              onOpenRWorkbench={() => {
                setRWorkbenchPinned(true)
                setRWorkbenchOpen(true)
              }}
            />
          )}
          {isUserModified && (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[var(--warning)] bg-[var(--warning-surface)]">
              <Pencil className="w-2.5 h-2.5" /> 已手动调整
            </span>
          )}
        </div>
      </div>

      {!showTabs ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" aria-hidden="true" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">{status === "error" ? "!" : ""}</div>
          )}
          <div className="space-y-1">
            <p className={`text-xs font-medium ${status === "error" ? "text-[var(--destructive)]" : "text-[var(--foreground)]"}`}>
              {busy ? "正在执行查询" : status === "error" ? "查询未完成" : "执行 SQL 后查看结果"}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {busy ? "结果准备好后会显示在这里" : status === "error" ? session.error || "请检查 SQL 和数据库连接后重试" : "查询结果、图表和明细会集中显示在此区域"}
            </p>
          </div>
          {sql && (
            <pre className="max-h-24 w-full max-w-xl overflow-auto rounded border border-[var(--border)] bg-[var(--muted)] p-2 text-left text-[10px] leading-relaxed text-[var(--muted-foreground)]">
              {sql}
            </pre>
          )}
          {status === "error" && <div role="alert" className="sr-only">{session.error || "查询失败"}</div>}
        </div>
      ) : (
        <>
          {busy && (
            <div className="shrink-0 border-b border-[var(--border)] bg-[var(--muted)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)]" aria-live="polite">
              正在更新结果，当前结果仍可查看
            </div>
          )}

          {/* 三层视图：洞察 / 探索 / 明细 */}
          <Tabs value={tab} onValueChange={(v) => changeTab(String(v))} className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="shrink-0 px-3 pt-2">
              <TabsList variant="line">
                {hasInsights && (
                  <TabsTrigger value="insights" title="AI 给出的结论与可执行建议">
                    洞察 {insights.length}
                  </TabsTrigger>
                )}
                <TabsTrigger value="explore" title="把结果画成图（可配置列映射）">探索</TabsTrigger>
                <TabsTrigger value="data" title="原始查询结果，不经过图表过滤">明细</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="insights" keepMounted className={PANEL_SCROLL}>
              <div className="space-y-2">
                {insights.map((item, i) => (
                  <InsightCard
                    key={`${item.title}-${i}`}
                    index={i}
                    item={item}
                    sql={i === activeInsightIndex ? sql || item.sql || null : item.sql || null}
                    onExecute={() => {
                      changeTab("explore")
                      onExecuteInsight?.(i)
                    }}
                    loading={executingInsightIndex === i}
                    error={executingInsightIndex === i ? insightError : null}
                    result={result}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="explore" keepMounted className={`${PANEL_SCROLL} space-y-2`}>
              {result && bound ? (
                <>
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
                embedded
              />
                </>
              ) : (
                <p className="text-[11px] text-[var(--muted-foreground)]">查询结果未保留，点击编辑器「执行」重看本次结果。</p>
              )}
            </TabsContent>

            <TabsContent value="data" keepMounted className={PANEL_FILL}>
              {result && bound ? (
                /* 明细取原始查询结果：图表绑定会按数值槽位过滤行，不能作为明细的数据源 */
                <div className="h-full min-h-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
                  <Chart mapping={{ chartType: "table" }} data={result.rows} fillHeight />
                </div>
              ) : (
                <p className="text-[11px] text-[var(--muted-foreground)]">查询结果未保留，点击编辑器「执行」重看本次结果。</p>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* R 分析工作台：右侧停靠面板（导出菜单「R 分析」打开），固定定位不占用结果区 flex 流 */}
      {result && rWorkbenchPinned && (
        <RWorkbench
          dataset={result}
          open={rWorkbenchOpen}
          onClose={() => setRWorkbenchOpen(false)}
          connectionId={connectionId ?? ""}
          sessionId={session.id}
          sourceSql={sql}
          replayId={replayRId}
        />
      )}
    </div>
  )
}
