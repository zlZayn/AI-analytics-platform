"use client"

// SQL 编辑器单元：工具栏（保存查询 + 执行）与 Monaco 草稿编辑器。
// 草稿 owner 仍在父组件（AI 助手会写它），本组件只负责渲染与本地 monaco 就绪。
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { SaveQueryControl } from "@/components/workspace/save-query-control"
import { Play, Loader2 } from "lucide-react"
// 本地 monaco（惰性配置：SSR 安全，配置完成前编辑器渲染占位）
import { configureMonaco } from "@/lib/monaco-setup"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-full bg-[var(--muted)] animate-pulse rounded-lg" />,
})

interface SqlEditorPanelProps {
  connectionId: string
  sqlDraft: string
  onDraftChange: (value: string) => void
  /** 已编译的 SQL；缺失时「保存查询」禁用（与搬出前一致） */
  compiledSql: string | undefined
  busy: boolean
  onRun: () => void
}

export function SqlEditorPanel({ connectionId, sqlDraft, onDraftChange, compiledSql, busy, onRun }: SqlEditorPanelProps) {
  const [monacoReady, setMonacoReady] = useState(false)

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

  // SQL 编辑器（草稿输入，执行时由父组件 dispatch SET_COMPILED_SQL）；高度由分割条决定
  return (
    <div className="flex min-h-[160px] shrink-0 flex-col gap-2 max-lg:h-48 max-lg:sm:h-56 lg:min-h-0 lg:shrink lg:[flex-basis:0] lg:[flex-grow:var(--editor-grow)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">SQL 编辑器</span>
        <div className="flex items-center gap-1.5">
          <SaveQueryControl connectionId={connectionId} sql={compiledSql} />
          <Button size="sm" onClick={onRun} disabled={busy || !sqlDraft.trim()} aria-busy={busy} className="gap-1 h-7 text-xs">
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
            onChange={(v) => onDraftChange(v || "")}
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
  )
}
