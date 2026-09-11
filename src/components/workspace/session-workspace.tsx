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
import { SPLIT_PRESETS } from "@/lib/split"
import { useSplitRatio } from "@/hooks/useSplitRatio"
import { SplitHandle } from "@/components/ui/split-handle"
import type { CSSProperties } from "react"
import { loadWorkspace, saveWorkspace } from "@/lib/workspace-store"

// 本地 monaco（惰性配置：SSR 安全，配置完成前编辑器渲染占位）
import { configureMonaco } from "@/lib/monaco-setup"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-full bg-[var(--muted)] animate-pulse rounded-lg" />,
})

interface SessionWorkspaceProps {
  connectionId: string | null
  initialSql: string
  /** R 历史回放：统一历史中的 R 条目 id（来自 URL `?r=`），结果就绪后自动打开面板并载入该代码 */
  rHistoryId?: string
}

export function SessionWorkspace({ connectionId, initialSql, rHistoryId }: SessionWorkspaceProps) {
  // 恢复上次离开时的工作台（按连接）：会话骨架 + 洞察流；结果行不持久化，回来点一次「执行」即可重看
  const restored = useMemo(() => loadWorkspace(connectionId), [connectionId])
  const [schema, setSchema] = useState<SchemaData | null>(null)
  const [sqlDraft, setSqlDraft] = useState(
    () => normalizeWorkspaceSql(initialSql) || restored?.lastSql || "",
  )
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [monacoReady, setMonacoReady] = useState(false)
  // Navigation can hydrate in more than one render. Track the applied input by
  // value so a late-arriving query is still loaded once without overwriting edits.
  const appliedInitialSqlKey = useRef<string | null>(null)
  // 结果区当前 Tab（受控）：新洞察到达切「洞察」（结论前置），执行卡片切「探索」；
  // 恢复场景没有结果可看，直接停在「洞察」，否则用户回来面对的是一块空的结果区
  const [resultTab, setResultTab] = useState(() =>
    restored?.insights?.length ? "insights" : "explore",
  )
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
    initialSession: restored?.session,
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
    initialInsights: restored?.insights,
  })

  // 布局分割：统一句柄 + 本地记忆（编辑器高度 / AI 与结果列宽），窄屏不显示句柄、回到纵向滚动
  const workspaceRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)
  const editorSplit = useSplitRatio(
    SPLIT_PRESETS.workspaceEditor.key,
    SPLIT_PRESETS.workspaceEditor.defaultRatio,
    SPLIT_PRESETS.workspaceEditor.bounds,
  )
  const columnsSplit = useSplitRatio(
    SPLIT_PRESETS.workspaceColumns.key,
    SPLIT_PRESETS.workspaceColumns.defaultRatio,
    SPLIT_PRESETS.workspaceColumns.bounds,
  )

  // 持久化：会话骨架 + 洞察流，立即写（会话对象只在 dispatch 时变化，粒度足够粗）；
  // 不做防抖——组件卸载时定时器会被 cleanup 取消，反而丢掉最后一刻的状态。
  // 空会话不写，避免留下无意义快照。
  useEffect(() => {
    if (!connectionId) return
    if (session.status === "idle" && session.conversationHistory.length === 0 && assistant.insights.length === 0) return
    saveWorkspace(connectionId, { session, insights: assistant.insights })
  }, [connectionId, session, assistant.insights])

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
    <div
      style={
        {
          "--editor-grow": editorSplit.ratio,
          "--content-grow": 1 - editorSplit.ratio,
          "--ai-grow": columnsSplit.ratio,
          "--result-grow": 1 - columnsSplit.ratio,
        } as CSSProperties
      }
      className="flex h-full min-h-0 flex-col overflow-y-auto p-3 sm:p-4 lg:overflow-hidden"
    >
      {/* 顶部：标题 + 洞察（执行状态只在结果区头部显示一处） */}
      <div className="min-w-0 px-1 pb-3">
        <div className="text-sm font-medium truncate">{title || "会话工作台"}</div>
        {insight && <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{insight}</p>}
      </div>

      {/* 主区：编辑器与中段共享高度，lg 及以上可用分割条调整 */}
      <div ref={workspaceRef} className="flex min-h-0 flex-col lg:min-h-0 lg:flex-1">

      {/* SQL 编辑器（草稿输入，执行时 dispatch SET_COMPILED_SQL）；高度由分割条决定 */}
      <div className="flex min-h-[160px] shrink-0 flex-col gap-2 max-lg:h-48 max-lg:sm:h-56 lg:min-h-0 lg:shrink lg:[flex-basis:0] lg:[flex-grow:var(--editor-grow)]">
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

      <SplitHandle
        axis="y"
        ratio={editorSplit.ratio}
        bounds={SPLIT_PRESETS.workspaceEditor.bounds}
        onPreview={editorSplit.preview}
        onCommit={editorSplit.commit}
        onReset={editorSplit.reset}
        containerRef={workspaceRef}
        label="调整 SQL 编辑器高度（双击或 Home 复位）"
        className="hidden lg:flex"
      />

      {/* 中间：AI 助手 + 结果（lg 及以上可用分割条调整列宽） */}
      <div
        ref={columnsRef}
        className="flex min-h-0 flex-none flex-col gap-3 pt-3 lg:min-h-0 lg:flex-row lg:gap-0 lg:pt-0 lg:overflow-hidden lg:[flex-basis:0] lg:[flex-grow:var(--content-grow)]"
      >
        {/* AI 助手 */}
        <div className="flex min-h-[260px] min-w-0 flex-1 flex-col rounded-lg border lg:min-h-0 lg:[flex-basis:0] lg:[flex-grow:var(--ai-grow)]">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">AI 助手</span>
              <span className="hidden truncate text-[10px] text-[var(--muted-foreground)] sm:inline">
                提问 → 给出可执行洞察 → 点卡片「执行」看结果
              </span>
            </span>
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

        <SplitHandle
          axis="x"
          ratio={columnsSplit.ratio}
          bounds={SPLIT_PRESETS.workspaceColumns.bounds}
          onPreview={columnsSplit.preview}
          onCommit={columnsSplit.commit}
          onReset={columnsSplit.reset}
          containerRef={columnsRef}
          thickness={8}
          label="调整 AI 助手与结果区宽度（双击或 Home 复位）"
          className="hidden lg:flex"
        />

        {/* 结果（阶段四：SessionView 按状态渲染 loading / error / 图表，并展示警告与调整） */}
        <div className="flex min-h-[360px] min-w-0 flex-1 flex-col lg:min-h-0 lg:[flex-basis:0] lg:[flex-grow:var(--result-grow)]">
          <SessionView
            session={session}
            connectionId={connectionId}
            replayRId={rHistoryId || undefined}
            onMappingChange={handleMappingChange}
            onCopySql={() => {
              if (compiledSql?.sql) {
                navigator.clipboard.writeText(compiledSql.sql)
                toast("SQL 已复制", "success")
              }
            }}
            insights={assistant.insights}
            executingInsightIndex={busy ? assistant.executingIndex : null}
            activeInsightIndex={assistant.activeInsightIndex}
            insightError={status === "error" && assistant.executingIndex !== null ? error ?? null : null}
            onExecuteInsight={assistant.execute}
            tab={resultTab}
            onTabChange={setResultTab}
          />
        </div>
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
