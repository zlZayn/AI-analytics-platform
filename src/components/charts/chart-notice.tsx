import type { ReactNode } from "react"

export function ChartNotice({ children, tone = "warning" }: { children: ReactNode; tone?: "warning" | "muted" }) {
  const colors = tone === "warning"
    ? "border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning)]"
    : "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]"
  return <div className={`mb-2 rounded border px-3 py-1.5 text-xs ${colors}`}>{children}</div>
}
