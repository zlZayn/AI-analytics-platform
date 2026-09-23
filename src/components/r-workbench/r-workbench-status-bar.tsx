"use client"

interface RWorkbenchStatusBarProps {
  packages: string[]
  lastExecMs: number | null
  busy: boolean
  status: "idle" | "loading" | "ready" | "error"
  error?: string | undefined
  /** 正在把当前结果集注入 df（由 WebRClient 状态驱动） */
  injecting?: boolean
}

/** R 工作台状态栏：运行状态（含初始化失败）+ 包状态 + 注入进度 + 最近执行耗时。 */
export function RWorkbenchStatusBar({
  packages,
  lastExecMs,
  busy,
  status,
  error,
  injecting,
}: RWorkbenchStatusBarProps) {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--muted-foreground)]">
      <span aria-live="polite">
        {status === "error" ? (
          <span className="text-[var(--destructive)]">初始化失败{error ? `: ${error}` : ""}</span>
        ) : status === "loading" ? (
          "正在加载 R 运行时…"
        ) : busy ? (
          "执行中…"
        ) : (
          "就绪"
        )}
        {packages.length > 0 && ` · 已加载包: ${packages.join(", ")}`}
      </span>
      <span className="ml-auto flex items-center gap-3">
        {injecting && <span>正在注入当前结果集为 df…（首次加载 R 运行时约 8MB）</span>}
        {lastExecMs !== null && <span>上次执行 {((lastExecMs / 1000).toFixed(2))}s</span>}
      </span>
    </footer>
  )
}
