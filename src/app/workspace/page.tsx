"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ResultPanel } from "@/components/dashboard/result-panel"
import { useToast } from "@/components/toast"
import type { QueryResult } from "@/types"
import { Play, Trash2, Save, Loader2, Send, Copy } from "lucide-react"
import dynamic from "next/dynamic"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-full bg-[var(--muted)] animate-pulse rounded-lg" />,
})

function WorkspaceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const connectionId = searchParams.get("connection")
  const initialSql = searchParams.get("sql") || ""

  const [sql, setSql] = useState(initialSql)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // AI state
  const [aiInput, setAiInput] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiHistory, setAiHistory] = useState<{ role: "user" | "ai"; content: string; sql?: string }[]>([])

  // Save dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState("")

  const { toast } = useToast()

  // Load SQL from URL param
  useEffect(() => {
    if (initialSql) setSql(initialSql)
  }, [initialSql])

  async function execute(targetSql?: string) {
    const q = targetSql || sql
    if (!connectionId || !q.trim()) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, sql: q }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.data)
        setSql(q)
        toast(`查询完成: ${data.data.rowCount} 行, ${data.data.executionTimeMs}ms`, "success")
      } else {
        setError(data.error)
      }
    } catch {
      setError("查询执行失败")
    } finally {
      setLoading(false)
    }
  }

  async function sendAi() {
    if (!connectionId || !aiInput.trim() || aiLoading) return
    const msg = aiInput.trim()
    setAiInput("")
    setAiHistory((prev) => [...prev, { role: "user", content: msg }])
    setAiLoading(true)
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, message: msg }),
      })
      const data = await res.json()
      if (data.success) {
        setAiHistory((prev) => [...prev, { role: "ai", content: data.data.explanation, sql: data.data.sql }])
        setSql(data.data.sql)
        toast("AI 已生成 SQL", "success")
      } else {
        setAiHistory((prev) => [...prev, { role: "ai", content: `错误: ${data.error}` }])
      }
    } catch {
      setAiHistory((prev) => [...prev, { role: "ai", content: "请求失败" }])
    } finally {
      setAiLoading(false)
    }
  }

  async function saveQuery() {
    if (!saveName.trim() || !sql.trim() || !connectionId) return
    await fetch("/api/query/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, name: saveName, sql }),
    })
    setSaveDialogOpen(false)
    setSaveName("")
    toast("查询已保存", "success")
  }

  if (!connectionId) {
    return <div className="p-6 flex items-center justify-center min-h-[50vh] text-[var(--muted-foreground)] text-xs">请先选择数据库连接</div>
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col p-4 overflow-hidden">
      {/* Top: SQL + AI side by side */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* SQL Editor */}
        <div className="flex-[3] flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">SQL 编辑器</span>
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
            <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-600 font-mono">{error}</div>
          )}
        </div>

        {/* AI Assistant */}
        <div className="flex-[2] flex flex-col min-w-0 border rounded-lg">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">AI 助手</span>
            <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setAiHistory([])} disabled={!aiHistory.length}>
              清空
            </Button>
          </div>
          {/* AI Messages */}
          <div className="flex-1 overflow-auto p-3 space-y-2 min-h-0">
            {aiHistory.length === 0 && (
              <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-xs">
                用自然语言描述你想分析的内容
              </div>
            )}
            {aiHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs ${
                  msg.role === "user" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] text-[var(--foreground)]"
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.sql && (
                    <div className="mt-1.5 relative group">
                      <pre className="p-1.5 rounded bg-black/5 text-[10px] font-mono overflow-x-auto">{msg.sql}</pre>
                      <button
                        className="absolute top-0.5 right-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 hover:bg-black/20"
                        onClick={() => { navigator.clipboard.writeText(msg.sql!); toast("已复制", "success") }}
                      >
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
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
          {/* AI Input */}
          <div className="p-2 border-t flex gap-1.5">
            <Input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="描述你想分析的内容..."
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

      {/* Bottom: Results - scrollable within fixed height */}
      {result && (
        <div className="shrink-0 mt-3 max-h-[40vh] overflow-auto border rounded-lg">
          <ResultPanel
            result={result}
            onCopySql={() => { navigator.clipboard.writeText(sql); toast("SQL 已复制", "success") }}
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
              <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="例如：各药店会员统计" className="h-8 text-sm" autoFocus />
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

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--muted-foreground)] text-xs">加载中...</div>}>
      <WorkspaceContent />
    </Suspense>
  )
}
