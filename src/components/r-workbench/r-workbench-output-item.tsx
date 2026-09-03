"use client"

import type { ROutputItem } from "@/lib/webr-client"

/** 单条 R 输出：按 type 分级渲染（对齐既有 token，不新增颜色）。 */
export function RWorkbenchOutputItem({ item }: { item: ROutputItem }) {
  switch (item.type) {
    case "error":
    case "stderr":
      return (
        <pre role="alert" className="whitespace-pre-wrap break-all text-[var(--destructive)]">
          {item.data}
        </pre>
      )
    case "warning":
      return (
        <div
          role="alert"
          className="whitespace-pre-wrap break-all rounded bg-[var(--warning-surface)] px-1.5 py-0.5 text-[var(--warning)]"
        >
          {item.data}
        </div>
      )
    case "message":
      return <pre className="whitespace-pre-wrap break-all text-[var(--muted-foreground)]">{item.data}</pre>
    default:
      return <pre className="whitespace-pre-wrap break-all text-[var(--foreground)]">{item.data}</pre>
  }
}