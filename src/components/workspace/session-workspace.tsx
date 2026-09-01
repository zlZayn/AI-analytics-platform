"use client"

// 阶段二：会话状态驱动的工作台（feature flag 切换，旧版保留在 page.tsx）
// 状态是唯一真相：session 替代 sql / result / pendingChartMapping / aiHistory / error 五个独立 state。
// 所有用户操作 → dispatch(SessionAction)；查询的编译与执行由 useSession 的三个副作用驱动。
//
// 阶段二过渡说明：AI 接口仍只返回 sql + chart（不含 querySpec）。
// 因此这里在 INIT_FROM_AI 后通过 SET_COMPILED_SQL 直接注入 AI 生成的 SQL 触发执行；
// 阶段三 AI 输出 querySpec 后，将由 querySpec → compile 管线取代此直通路径。

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResultPanel } from "@/components/dashboard/result-panel"
import type { InsightItem } from "@/components/insight-card"
import { useToast } from "@/components/toast"
import { fetchApi, ApiRequestError } from "@/lib/client-api"
import { useSession } from "@/hooks/useSession"
import type { ApiResponse, QueryResult, SchemaData } from "@/types"
import type { CompiledSql, ConversationMessage, SemanticDataset } from "@/types/session"
import type { ChartMapping } from "@/components/chart"
import { Play, Loader2, Send } from "lucide-react"

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
  const { toast } = useToast()

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

  // 执行编译后的 SQL：过渡期将 QueryResult 转成 SemanticDataset（阶段四由 query-engine 直接返回）
  const executeCompiled = useMemo(
    () =>
      async (compiled: CompiledSql, cid: string): Promise<SemanticDataset> => {
        const data = await fetchApi<ApiResponse<QueryResult>>("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: cid, sql: compiled.sql }),
        })
        if (!data.success) {
          throw new Error(data.error.message || "查询执行失败")
        }
        return {
          ...data.data,
          columns: data.data.columns.map((c) => ({ ...c, semanticType: "unknown" as const })),
        }
      },
    [],
  )

  const { session, dispatch } = useSession({
    connectionId,
    schema,
    executeCompiled,
  })

  const { status, result, compiledSql, displayConfig, conversationHistory, error, title, insight } = session
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
        body: JSON.stringify({ connectionId, message: msg, conversationHistory: history }),
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
      const item = items[0]
      dispatch({
        type: "INIT_FROM_AI",
        payload: {
          question: msg,
          title: item.title,
          insight: item.insight,
          // 阶段二过渡：AI 仅返回 sql，querySpec 留占位；阶段三 AI 输出 querySpec 后填充
          querySpec: { table: "" },
          displayConfig: { chartType: item.chart.chartType, mapping: item.chart },
        },
      })
      dispatch({
        type: "SET_COMPILED_SQL",
        compiledSql: { sql: item.sql, params: [] },
      })
      dispatch({
        type: "ADD_CONVERSATION",
        message: assistantMessage(item.insight || item.title),
      })
      setSqlDraft(item.sql)
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

  function handleMappingChange(mapping: ChartMapping) {
    dispatch({
      type: "UPDATE_DISPLAY_CONFIG",
      displayConfig: { ...displayConfig, mapping },
    })
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
          <Button size="sm" onClick={runSql} disabled={busy || !sqlDraft.trim()} className="gap-1 h-7 text-xs">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {busy ? "执行中" : "执行"}
          </Button>
        </div>
        <div className="flex-1 border rounded-lg overflow-hidden min-h-0">
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
              <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => dispatch({ type: "RESET" })} disabled={busy || aiLoading}>
                重置
              </Button>
            )}
          </div>
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

        {/* 结果 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-[3]">
          {busy && !result && (
            <div className="flex items-center justify-center min-h-[200px] rounded-lg border text-xs text-[var(--muted-foreground)]">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 查询执行中...
            </div>
          )}
          {result && (
            <div className="min-h-0 overflow-auto rounded-lg border">
              <ResultPanel
                result={result}
                onCopySql={() => {
                  if (compiledSql?.sql) {
                    navigator.clipboard.writeText(compiledSql.sql)
                    toast("SQL 已复制", "success")
                  }
                }}
                mapping={displayConfig.mapping}
                onMappingChange={handleMappingChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
