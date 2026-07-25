"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ResultPanel } from "@/components/dashboard/result-panel"
import { InsightCard, type InsightItem } from "@/components/insight-card"
import { type ChartMapping } from "@/components/chart"
import { useToast } from "@/components/toast"
import type { ApiResponse, QueryResult } from "@/types"
import { Play, Trash2, Save, Loader2, Send, ChevronDown, ChevronUp } from "lucide-react"
import dynamic from "next/dynamic"
import { fetchApi, ApiRequestError } from "@/lib/client-api"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-full bg-[var(--muted)] animate-pulse rounded-lg" />,
})

function WorkspaceContent({ connectionId, initialSql }: { connectionId: string | null; initialSql: string }) {
  const [sql, setSql] = useState(initialSql)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Editor expand/collapse
  const [editorExpanded, setEditorExpanded] = useState(true)

  // AI state
  const [aiInput, setAiInput] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const [aiHistory, setAiHistory] = useState<{ role: "user" | "ai"; content: string; items?: InsightItem[] }[]>([])

  // Insight execution state
  const [executingInsightIndex, setExecutingInsightIndex] = useState<number | null>(null)
  const [pendingChartMapping, setPendingChartMapping] = useState<ChartMapping | null>(null)

  // Save dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  const queryController = useRef<AbortController | null>(null)
  const aiController = useRef<AbortController | null>(null)

  const { toast } = useToast()

  useEffect(() => () => {
    queryController.current?.abort()
    aiController.current?.abort()
  }, [])

  async function execute(targetSql?: string) {
    const q = targetSql || sql
    if (!connectionId || !q.trim()) return
    setLoading(true)
    setError("")
    setExecutingInsightIndex(null)
    queryController.current?.abort()
    const controller = new AbortController()
    queryController.current = controller
    try {
      const data = await fetchApi<ApiResponse<QueryResult>>("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, sql: q }),
        signal: controller.signal,
      })
      if (data.success && queryController.current === controller) {
        setResult(data.data)
        setSql(q)
        setEditorExpanded(false)
        toast(`查询完成: ${data.data.rowCount} 行, ${data.data.executionTimeMs}ms`, "success")
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && queryController.current === controller) {
        setError(error instanceof ApiRequestError ? error.message : "查询执行失败")
      }
    } finally {
      if (queryController.current === controller) setLoading(false)
    }
  }

  async function sendAi() {
    if (!connectionId || !aiInput.trim() || aiLoading) return
    const msg = aiInput.trim()
    setAiInput("")
    setAiHistory((prev) => [...prev, { role: "user", content: msg }])
    setAiLoading(true)
    aiController.current?.abort()
    const controller = new AbortController()
    aiController.current = controller
    try {
      const data = await fetchApi<ApiResponse<{ items: InsightItem[] }>>("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, message: msg }),
        signal: controller.signal,
      })
      if (data.success && aiController.current === controller) {
        setAiUnavailable(false)
        const items = data.data.items
        if (items.length > 0) {
          setAiHistory((prev) => [...prev, {
            role: "ai",
            content: items[0].insight || items[0].title,
            items
          }])
          toast(`已生成 ${items.length} 条分析`, "success")
        } else {
          setAiHistory((prev) => [...prev, { role: "ai", content: "未生成有效结果" }])
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && aiController.current === controller) {
        const message = error instanceof ApiRequestError ? error.message : "请求失败"
        setAiHistory((prev) => [...prev, { role: "ai", content: message }])
        if (error instanceof ApiRequestError && error.code === "AI_NOT_CONFIGURED") {
          setAiUnavailable(true)
          toast("AI 服务未配置，请在 .env 文件中设置 AI_API_KEY", "warning")
        }
      }
    } finally {
      if (aiController.current === controller) setAiLoading(false)
    }
  }

  async function executeInsight(sql: string, chart: InsightItem["chart"], index: number) {
    if (!connectionId || !sql.trim()) return
    setExecutingInsightIndex(index)
    setLoading(true)
    setError("")
    queryController.current?.abort()
    const controller = new AbortController()
    queryController.current = controller
    try {
      const data = await fetchApi<ApiResponse<QueryResult>>("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, sql }),
        signal: controller.signal,
      })
      if (data.success && queryController.current === controller) {
        setResult(data.data)
        setSql(sql)

        setPendingChartMapping(chart)

        setEditorExpanded(false)
        toast(`洞察执行完成: ${data.data.rowCount} 行`, "success")
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && queryController.current === controller) {
        setError(error instanceof ApiRequestError ? error.message : "洞察执行失败")
      }
    } finally {
      if (queryController.current === controller) {
        setLoading(false)
        setExecutingInsightIndex(null)
      }
    }
  }

  async function saveQuery() {
    if (!saveName.trim() || !sql.trim() || !connectionId) return
    try {
      await fetchApi("/api/query/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, name: saveName, sql }),
      })
      setSaveDialogOpen(false)
      setSaveName("")
      toast("查询已保存", "success")
    } catch (error) {
      toast(error instanceof ApiRequestError ? error.message : "保存失败，请重试", "error")
    }
  }

  if (!connectionId) {
    return <div className="p-6 flex items-center justify-center min-h-[50vh] text-[var(--muted-foreground)] text-xs">请先选择数据库连接</div>
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4">
      {/* Collapsed header - show when editor is collapsed */}
      {result && !editorExpanded && (
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)] rounded-lg cursor-pointer hover:bg-[var(--accent)] transition-colors mb-3" onClick={() => setEditorExpanded(true)}>
          <div className="flex items-center gap-2">
            <ChevronDown className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <span className="text-xs font-medium text-[var(--muted-foreground)]">SQL 编辑器</span>
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono truncate max-w-[300px]">
              {sql.slice(0, 80)}{sql.length > 80 ? "..." : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={(e) => { e.stopPropagation(); execute() }} disabled={loading}>
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              重新执行
            </Button>
          </div>
        </div>
      )}

      {/* Expanded editor area */}
      {editorExpanded && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          {/* SQL Editor */}
          <div className="flex min-h-[340px] min-w-0 flex-1 flex-col lg:min-h-0 lg:flex-[3]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--muted-foreground)]">SQL 编辑器</span>
                {result && (
                  <button className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-0.5" onClick={() => setEditorExpanded(false)}>
                    <ChevronUp className="w-3 h-3" />
                    收起
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" onClick={() => execute()} disabled={loading || !sql.trim()} className="gap-1 h-7 text-xs">
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {loading ? "执行中" : "执行"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setSql(""); setResult(null); setError("") }} disabled={loading} className="h-7 text-xs gap-1">
                  <Trash2 className="w-3 h-3" /> 清空
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSaveDialogOpen(true)} disabled={!sql.trim()} className="h-7 text-xs gap-1">
                  <Save className="w-3 h-3" /> 保存
                </Button>
              </div>
            </div>
            <div className="flex-1 border rounded-lg overflow-hidden min-h-0">
              <MonacoEditor
                height="100%"
                language="sql"
                theme="vs-light"
                value={sql}
                onChange={(v) => setSql(v || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  padding: { top: 8, bottom: 8 },
                  tabSize: 2,
                }}
              />
            </div>
            {error && (
              <div className="mt-2 rounded border border-[var(--destructive-border)] bg-[var(--destructive-surface)] p-2 font-mono text-xs text-[var(--destructive)]">{error}</div>
            )}
          </div>

          {/* AI Assistant */}
          <div className="flex min-h-[240px] min-w-0 flex-1 flex-col rounded-lg border lg:min-h-0 lg:flex-[2]">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">AI 助手</span>
              <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setAiHistory([])} disabled={!aiHistory.length}>
                清空
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2 min-h-0">
              {aiUnavailable && (
                <div className="p-2 rounded bg-[var(--muted)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] leading-relaxed">
                  AI 服务未配置。请在 <code className="font-mono bg-[var(--border)] px-1 rounded">.env</code> 中设置
                  {' '}<code className="font-mono bg-[var(--border)] px-1 rounded">AI_API_KEY</code>。
                </div>
              )}
              {aiHistory.length === 0 && !aiUnavailable && (
                <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-xs">
                  用自然语言描述你想分析的内容
                </div>
              )}
              {aiHistory.map((msg, i) => (
                <div key={i} className={`${msg.role === "user" ? "flex justify-end" : "space-y-2"}`}>
                  {msg.role === "user" ? (
                    <div className="max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs bg-[var(--primary)] text-[var(--primary-foreground)]">
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ) : (
                    <>
                      {/* 分析卡片 */}
                      {msg.items && msg.items.length > 0 && (
                        <div className="space-y-1.5">
                          {msg.items.map((item, j) => (
                            <InsightCard
                              key={j}
                              index={j}
                              item={item}
                              onExecute={(sql, chart) => executeInsight(sql, chart, j)}
                              loading={executingInsightIndex === j}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--muted)] rounded-lg px-2.5 py-1.5 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                    <Loader2 className="w-3 h-3 animate-spin" /> 思考中...
                  </div>
                </div>
              )}
            </div>
            <div className="p-2 border-t flex gap-1.5">
              <Input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="描述你想分析的内容，如：给我一些数据洞察"
                disabled={aiLoading}
                className="h-7 text-xs"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendAi())}
              />
              <Button size="sm" onClick={sendAi} disabled={aiLoading || !aiInput.trim()} className="h-7 w-7 p-0">
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results area */}
      {result && (
        <div className={`${editorExpanded ? "mt-3 max-h-[42vh] shrink-0 overflow-auto" : "min-h-0 flex-1 overflow-auto"} rounded-lg border`}>
          <ResultPanel
            result={result}
            onCopySql={() => { navigator.clipboard.writeText(sql); toast("SQL 已复制", "success") }}
            initialMapping={pendingChartMapping || undefined}
          />
        </div>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>保存查询</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">名称</Label>
              <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="例如：月度销售趋势" className="h-8 text-sm" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)}>取消</Button>
            <Button size="sm" onClick={saveQuery} disabled={!saveName.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WorkspaceRoute() {
  const searchParams = useSearchParams()
  const connectionId = searchParams.get("connection")
  const initialSql = searchParams.get("sql") || ""
  return <WorkspaceContent key={`${connectionId ?? ""}:${initialSql}`} connectionId={connectionId} initialSql={initialSql} />
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--muted-foreground)] text-xs">加载中...</div>}>
      <WorkspaceRoute />
    </Suspense>
  )
}
