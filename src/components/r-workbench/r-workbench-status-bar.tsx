"use client"

interface RWorkbenchStatusBarProps {
  packages: string[]
  lastExecMs: number | null
  busy: boolean
  status: "idle" | "loading" | "ready" | "error"
  error?: string
}

/** R 工作台状态栏：运行状态（含初始化失败）+ 包状态 + 最近执行耗时（28px 高）。 */
export function RWorkbenchStatusBar({ packages, lastExecMs, busy, status, error }: RWorkbenchStatusBarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-[10px] text-[var(--muted-foreground)]">
      <span>
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
      {lastExecMs !== null && <span>上次执行 {((lastExecMs / 1000).toFixed(2))}s</span>}
    </div>
  )
}