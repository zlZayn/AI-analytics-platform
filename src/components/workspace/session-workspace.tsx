"use client"

// 会话状态驱动的工作台（唯一实现）：
// 状态是唯一真相：session 替代 sql / result / pendingChartMapping / aiHistory / error 五个独立 state。
// 所有用户操作 → dispatch(SessionAction)；查询的编译与执行由 useSession 的三个副作用驱动。
// AI 双变体：querySpec 优先（编译管线），缺失时 sql 直通（SET_COMPILED_SQL）。

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { SessionView } from "@/components/SessionView"
import type { InsightItem } from "@/components/insight-card"
import { AiVisibilityHint } from "@/components/ai-visibility-hint"
import { useToast } from "@/components/toast"
import { fetchApi, ApiRequestError } from "@/lib/client-api"
import { useSession } from "@/hooks/useSession"
import type { ApiResponse, SchemaData } from "@/types"
import type { CompiledSql, ConversationMessage, SemanticDataset } from "@/types/session"
import type { ChartMapping } from "@/components/chart"
import { Play, Loader2, Send, Save } from "lucide-react"
import { AiMentionInput } from "@/components/ai-mention-input"
import { extractMentions } from "@/lib/mention"

// 本地 monaco（惰性配置：SSR 安全，配置完成前编辑器渲染占位）
import { configureMonaco } from "@/lib/monaco-setup"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-full bg-[var(--muted)] animate-pulse rounded-lg" />,
})

interface SessionWorkspaceProps {
  connectionId: string | null
  initialSql: string
}

function assistantMessage(content: string): ConversationMessage {
  return { role: "assistant", content, createdAt: new Date() }
}

export function SessionWorkspace({ connectionId, initialSql }: SessionWorkspaceProps) {
  const [schema, setSchema] = useState<SchemaData | null>(null)
  const [sqlDraft, setSqlDraft] = useState(initialSql)
  const [aiInput, setAiInput] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [monacoReady, setMonacoReady] = useState(false)
  // AI 多洞察：会话外临时状态（同 RWorkbench 开关哲学，不进 AnalysisSession）
  const [insightItems, setInsightItems] = useState<InsightItem[]>([])
  const [executingInsight, setExecutingInsight] = useState<number | null>(null)
  // 结果区当前 Tab（受控）：新洞察到达切「洞察」（结论前置），执行卡片切「探索」
  const [resultTab, setResultTab] = useState("explore")
  const { toast } = useToast()

  // 配置本地 monaco（幂等；客户端首帧后异步完成，避免 loader.init 回退 CDN）
  useEffect(() => {
    let alive = true
    void configureMonaco().then(() => {
      if (alive) setMonacoReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  // 加载 Schema：供 schema-based 校验与 querySpec 编译使用（异步到达时由 useSession 的 ref 接管）
  useEffect(() => {
    if (!connectionId) return
    let cancelled = false
    fetchApi<ApiResponse<SchemaData>>(`/api/schema/${connectionId}`)
      .then((data) => {
        if (!cancelled && data.success) setSchema(data.data)
      })
      .catch(() => {
        if (!cancelled) setSchema(null)
      })
    return () => {
      cancelled = true
    }
  }, [connectionId])

  // 执行编译后的 SQL：阶段四起 query-engine 直接返回带 semanticType 的 SemanticDataset
  const executeCompiled = useMemo(
    () =>
      async (compiled: CompiledSql, cid: string): Promise<SemanticDataset> => {
        const data = await fetchApi<ApiResponse<SemanticDataset>>("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: cid, sql: compiled.sql }),
        })
        if (!data.success) {
          throw new Error(data.error.message || "查询执行失败")
        }
        return data.data
      },
    [],
  )

  const { session, dispatch } = useSession({
    connectionId,
    schema,
    executeCompiled,
  })

  const { status, compiledSql, displayConfig, conversationHistory, error, title, insight } = session
  const busy = status === "compiling" || status === "executing"

  async function sendAi() {
    if (!connectionId || !aiInput.trim() || aiLoading) return
    const msg = aiInput.trim()
    setAiInput("")
    // 记录用户提问（含会话上下文），随后调用 AI
    dispatch({ type: "ASK_AI", question: msg })
    setAiLoading(true)
    try {
      // 携带会话上下文（上一轮及之前的历史），实现多轮对话；本次提问由后端拼在最后
      const history = conversationHistory.map((m) => ({ role: m.role, content: m.content }))
      const data = await fetchApi<ApiResponse<{ items: InsightItem[] }>>("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          message: msg,
          conversationHistory: history,
          // @提及的表作为显式上下文：只扫这些表的数据轮廓
          referencedTables: extractMentions(msg),
        }),
      })
      if (!data.success) {
        throw new Error(data.error.message || "AI 分析失败")
      }
      const items = data.data.items
      if (items.length === 0) {
        dispatch({ type: "ADD_CONVERSATION", message: assistantMessage("未生成有效结果") })
        toast("AI 未生成有效结果", "warning")
        return
      }
      // 多洞察全部保留（洞察视图卡片流），第一条仍自动执行（结论前置 + 延续现状流程）
      setInsightItems(items)
      setResultTab("insights")
      const item = items[0]
      dispatch({
        type: "INIT_FROM_AI",
        payload: {
          question: msg,
          title: item.title,
          insight: item.insight,
          // 阶段三：AI 输出 querySpec + displayConfig 时由编译管线接管；
          // 回退（AI 仅输出 sql）时 querySpec 留空占位，走下方 sql 直通。
          querySpec: item.querySpec ?? { table: "" },
          displayConfig: item.displayConfig ?? { chartType: item.chart.chartType, mapping: item.chart },
        },
      })
      if (item.fallback || !item.querySpec) {
        // 回退路径：AI 未输出 querySpec，直接注入 AI 生成的 SQL 触发执行
        if (item.sql) {
          dispatch({ type: "SET_COMPILED_SQL", compiledSql: { sql: item.sql, params: [] } })
          setSqlDraft(item.sql)
        }
      }
      dispatch({
        type: "ADD_CONVERSATION",
        message: assistantMessage(item.insight || item.title),
      })
      toast(`已生成 ${items.length} 条分析，执行第 1 条`, "success")
    } catch (e) {
      const message = e instanceof ApiRequestError ? e.message : "请求失败"
      dispatch({ type: "ADD_CONVERSATION", message: assistantMessage(message) })
      if (e instanceof ApiRequestError && e.code === "AI_NOT_CONFIGURED") {
        setAiUnavailable(true)
        toast("AI 服务未配置，请在 .env 文件中设置 AI_API_KEY", "warning")
      }
    } finally {
      setAiLoading(false)
    }
  }

  function runSql() {
    if (!connectionId || !sqlDraft.trim()) return
    dispatch({
      type: "UPDATE_DISPLAY_CONFIG",
      displayConfig: { chartType: "table", mapping: { chartType: "table" } },
    })
    dispatch({ type: "SET_COMPILED_SQL", compiledSql: { sql: sqlDraft.trim(), params: [] } })
  }

  async function saveQuery() {
    if (!saveName.trim() || !compiledSql?.sql || !connectionId) return
    try {
      await fetchApi("/api/query/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, name: saveName.trim(), sql: compiledSql.sql }),
      })
      setSaveDialogOpen(false)
      setSaveName("")
      toast("查询已保存", "success")
    } catch {
      toast("保存失败，请稍后重试", "error")
    }
  }

  function handleMappingChange(mapping: ChartMapping) {
    dispatch({
      type: "UPDATE_DISPLAY_CONFIG",
      displayConfig: { ...displayConfig, mapping },
    })
  }

  /** 执行第 index 条洞察：走与 sendAi 相同的编译/执行管线（卡片 loading 态由 executingInsight 驱动） */
  function handleExecuteInsight(index: number) {
    const item = insightItems[index]
    if (!item) setExecutingInsight(null)
    else {
      setExecutingInsight(index)
      dispatch({
        type: "INIT_FROM_AI",
        payload: {
          question: item.title,
          title: item.title,
          insight: item.insight,
          querySpec: item.querySpec ?? { table: "" },
          displayConfig: item.displayConfig ?? { chartType: item.chart.chartType, mapping: item.chart },
        },
      })
      if (item.fallback || !item.querySpec) {
        // 回退路径：AI 未输出 querySpec，直接注入 AI 生成的 SQL 触发执行
        if (item.sql) {
          dispatch({ type: "SET_COMPILED_SQL", compiledSql: { sql: item.sql, params: [] } })
          setSqlDraft(item.sql)
        }
      }
    }
  }

  if (!connectionId) {
    return <div className="p-6 flex items-center justify-center min-h-[50vh] text-[var(--muted-foreground)] text-xs">请先选择数据库连接</div>
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4">
      {/* 顶部：标题 + 洞察 + 状态 */}
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{title || "会话工作台"}</div>
          {insight && <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{insight}</p>}
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-mono ${
            status === "error"
              ? "bg-[var(--destructive-surface)] text-[var(--destructive)]"
              : busy
                ? "bg-[var(--muted)] text-[var(--muted-foreground)]"
                : status === "ready"
                  ? "bg-[var(--muted)] text-[var(--success)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
          }`}
        >
          {status}
        </span>
      </div>

      {/* SQL 编辑器（草稿输入，执行时 dispatch SET_COMPILED_SQL） */}
      <div className="flex h-48 min-h-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">SQL 编辑器</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
              disabled={!compiledSql?.sql}
              className="h-7 text-xs gap-1"
            >
              <Save className="w-3.5 h-3.5" /> 保存
            </Button>
            <Button size="sm" onClick={runSql} disabled={busy || !sqlDraft.trim()} className="gap-1 h-7 text-xs">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {busy ? "执行中" : "执行"}
            </Button>
          </div>
        </div>
        <div className="flex-1 border rounded-lg overflow-hidden min-h-0">
          {monacoReady ? (
            <MonacoEditor
              height="100%"
              language="sql"
              theme="vs-light"
              value={sqlDraft}
              onChange={(v) => setSqlDraft(v || "")}
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
          ) : (
            <div className="h-full bg-[var(--muted)] animate-pulse rounded-lg" />
          )}
        </div>
        {error && (
          <div className="rounded border border-[var(--destructive-border)] bg-[var(--destructive-surface)] p-2 font-mono text-xs text-[var(--destructive)]">{error}</div>
        )}
      </div>

      {/* 中间：AI 助手 + 结果 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3 lg:flex-row">
        {/* AI 助手 */}
        <div className="flex min-h-[220px] min-w-0 flex-1 flex-col rounded-lg border lg:flex-[2]">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">AI 助手</span>
            {conversationHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px]"
                onClick={() => {
                  setInsightItems([])
                  dispatch({ type: "RESET" })
                }}
                disabled={busy || aiLoading}
              >
                重置
              </Button>
            )}
          </div>
          <AiVisibilityHint />
          <div className="flex-1 overflow-auto p-3 space-y-2 min-h-0">
            {aiUnavailable && (
              <div className="p-2 rounded bg-[var(--muted)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] leading-relaxed">
                AI 服务未配置。请在 <code className="font-mono bg-[var(--border)] px-1 rounded">.env</code> 中设置
                {' '}<code className="font-mono bg-[var(--border)] px-1 rounded">AI_API_KEY</code>。
              </div>
            )}
            {conversationHistory.length === 0 && !aiUnavailable && (
              <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-xs">
                用自然语言描述你想分析的内容
              </div>
            )}
            {conversationHistory.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs bg-[var(--primary)] text-[var(--primary-foreground)]">
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs bg-[var(--muted)] text-[var(--foreground)] whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ),
            )}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-[var(--muted)] rounded-lg px-2.5 py-1.5 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <Loader2 className="w-3 h-3 animate-spin" /> 思考中...
                </div>
              </div>
            )}
          </div>
          <div className="p-2 border-t flex gap-1.5">
            <AiMentionInput
              value={aiInput}
              onChange={setAiInput}
              onSend={sendAi}
              disabled={aiLoading}
              placeholder="输入 @ 选表，如：对比 @orders 与 @customers 的销售趋势"
              schema={schema}
            />
            <Button size="sm" onClick={sendAi} disabled={aiLoading || !aiInput.trim()} className="h-7 w-7 p-0">
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* 结果（阶段四：SessionView 按状态渲染 loading / error / 图表，并展示警告与调整） */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-[3]">
          <SessionView
            session={session}
            onMappingChange={handleMappingChange}
            onCopySql={() => {
              if (compiledSql?.sql) {
                navigator.clipboard.writeText(compiledSql.sql)
                toast("SQL 已复制", "success")
              }
            }}
            insights={insightItems}
            executingInsightIndex={busy ? executingInsight : null}
            insightError={status === "error" && executingInsight !== null ? error ?? null : null}
            onExecuteInsight={handleExecuteInsight}
            tab={resultTab}
            onTabChange={setResultTab}
          />
        </div>
      </div>

      {/* 保存查询对话框 */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>保存查询</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="save-name" className="text-xs">名称</Label>
            <Input
              id="save-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="查询名称"
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveQuery())}
            />
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
