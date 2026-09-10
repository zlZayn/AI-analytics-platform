"use client"

// 会话状态驱动的工作台（唯一实现）：
// 状态是唯一真相：session 替代 sql / result / pendingChartMapping / aiHistory / error 五个独立 state。
// 所有用户操作 → dispatch(SessionAction)；查询的编译与执行由 useSession 的三个副作用驱动。
// AI 编排在 useAiAssistant（输入/请求状态）；结果→会话 action 的映射在 lib/ai-session-mapping.ts。

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { SessionView } from "@/components/SessionView"
import { AiVisibilityHint } from "@/components/ai-visibility-hint"
import { useToast } from "@/components/toast"
import { fetchApi } from "@/lib/client-api"
import { useSession } from "@/hooks/useSession"
import { useAiAssistant } from "@/hooks/useAiAssistant"
import type { ApiResponse, SchemaData } from "@/types"
import type { CompiledSql, SemanticDataset } from "@/types/session"
import type { ChartMapping } from "@/components/chart"
import { Play, Loader2, Send, Save } from "lucide-react"
import { AiMentionInput } from "@/components/ai-mention-input"
import { normalizeWorkspaceSql, workspaceSqlKey } from "@/lib/workspace-navigation"

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

export function SessionWorkspace({ connectionId, initialSql }: SessionWorkspaceProps) {
  const [schema, setSchema] = useState<SchemaData | null>(null)
  const [sqlDraft, setSqlDraft] = useState(() => normalizeWorkspaceSql(initialSql))
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [monacoReady, setMonacoReady] = useState(false)
  // Navigation can hydrate in more than one render. Track the applied input by
  // value so a late-arriving query is still loaded once without overwriting edits.
  const appliedInitialSqlKey = useRef<string | null>(null)
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

  // 自动执行：从 /explorer「在工作台执行」/ /queries「执行」带 ?sql= 跳转到达时，
  // 填写编辑器并直接执行，无需用户手动点「执行」。依赖参数而非首帧，
  // 兼容客户端导航期间 connection/sql 分开到达的情况。
  useEffect(() => {
    const sql = normalizeWorkspaceSql(initialSql)
    const key = workspaceSqlKey(connectionId, sql)
    if (!key || appliedInitialSqlKey.current === key) return
    appliedInitialSqlKey.current = key
    setSqlDraft(sql)
    dispatch({ type: "UPDATE_DISPLAY_CONFIG", displayConfig: { chartType: "table", mapping: { chartType: "table" } } })
    dispatch({ type: "SET_COMPILED_SQL", compiledSql: { sql, params: [] } })
  }, [connectionId, initialSql, dispatch])

  const { status, compiledSql, displayConfig, conversationHistory, error, title, insight } = session
  const busy = status === "compiling" || status === "executing"

  // AI 助手编排（输入/请求/洞察流）：结果→会话 action 的映射由 Hook 内部统一处理
  const assistant = useAiAssistant({
    connectionId,
    session,
    dispatch,
    onSqlDraft: setSqlDraft,
    onTabChange: setResultTab,
    notify: toast,
  })

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

  if (!connectionId) {
    return <div className="p-6 flex items-center justify-center min-h-[50vh] text-[var(--muted-foreground)] text-xs">请先选择数据库连接</div>
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3 sm:p-4 lg:overflow-hidden">
      {/* 顶部：标题 + 洞察（执行状态只在结果区头部显示一处） */}
      <div className="min-w-0 px-1 pb-3">
        <div className="text-sm font-medium truncate">{title || "会话工作台"}</div>
        {insight && <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{insight}</p>}
      </div>

      {/* SQL 编辑器（草稿输入，执行时 dispatch SET_COMPILED_SQL） */}
      <div className="flex h-48 shrink-0 min-h-0 flex-col gap-2 sm:h-56 lg:h-48">
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
            <Button size="sm" onClick={runSql} disabled={busy || !sqlDraft.trim()} aria-busy={busy} className="gap-1 h-7 text-xs">
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
      </div>

      {/* 中间：AI 助手 + 结果 */}
      <div className="flex min-h-0 flex-none flex-col gap-3 pt-3 lg:flex-1 lg:flex-row lg:overflow-hidden">
        {/* AI 助手 */}
        <div className="flex min-h-[260px] min-w-0 flex-1 flex-col rounded-lg border lg:min-h-0 lg:flex-[2]">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">AI 助手</span>
            {conversationHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px]"
                onClick={() => {
                  assistant.clearInsights()
                  dispatch({ type: "RESET" })
                }}
                disabled={busy || assistant.asking}
              >
                重置
              </Button>
            )}
          </div>
          <AiVisibilityHint />
          <div className="flex-1 overflow-auto p-3 space-y-2 min-h-0">
            {assistant.unavailable && (
              <div className="p-2 rounded bg-[var(--muted)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] leading-relaxed">
                AI 服务未配置。请在 <code className="font-mono bg-[var(--border)] px-1 rounded">.env</code> 中设置
                {' '}<code className="font-mono bg-[var(--border)] px-1 rounded">AI_API_KEY</code>。
              </div>
            )}
            {conversationHistory.length === 0 && !assistant.unavailable && (
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
            {assistant.asking && (
              <div className="flex justify-start">
                <div className="bg-[var(--muted)] rounded-lg px-2.5 py-1.5 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <Loader2 className="w-3 h-3 animate-spin" /> 思考中...
                </div>
              </div>
            )}
          </div>
          <div className="p-2 border-t flex gap-1.5">
            <AiMentionInput
              value={assistant.input}
              onChange={assistant.setInput}
              onSend={assistant.ask}
              disabled={assistant.asking}
              placeholder="输入 @ 选表，如：对比 @orders 与 @customers 的销售趋势"
              schema={schema}
            />
            <Button size="sm" onClick={assistant.ask} disabled={assistant.asking || !assistant.input.trim()} className="h-7 w-7 p-0">
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* 结果（阶段四：SessionView 按状态渲染 loading / error / 图表，并展示警告与调整） */}
        <div className="flex min-h-[360px] min-w-0 flex-1 flex-col lg:min-h-0 lg:flex-[3]">
          <SessionView
            session={session}
            onMappingChange={handleMappingChange}
            onCopySql={() => {
              if (compiledSql?.sql) {
                navigator.clipboard.writeText(compiledSql.sql)
                toast("SQL 已复制", "success")
              }
            }}
            insights={assistant.insights}
            executingInsightIndex={busy ? assistant.executingIndex : null}
            insightError={status === "error" && assistant.executingIndex !== null ? error ?? null : null}
            onExecuteInsight={assistant.execute}
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
