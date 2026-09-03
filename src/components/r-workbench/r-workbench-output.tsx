"use client"

import { useEffect, useRef } from "react"
import { RWorkbenchOutputItem } from "./r-workbench-output-item"
import { RWorkbenchImage } from "./r-workbench-image"
import type { ROutputItem } from "@/lib/webr-client"

interface RWorkbenchOutputProps {
  items: ROutputItem[]
  images: ImageBitmap[]
  busy: boolean
}

/** R 输出流容器：分级渲染 + aria-live + 自动滚底（≤500 条截断）。 */
export function RWorkbenchOutput({ items, images, busy }: RWorkbenchOutputProps) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [items.length, images.length])

  return (
    <div
      aria-live="polite"
      className="min-h-[80px] max-h-[280px] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-2 space-y-1 font-mono text-[11px]"
    >
      {items.length === 0 && !busy && (
        <div className="text-[var(--muted-foreground)]">等待运行…（代码将在此显示输出与图表）</div>
      )}
      {busy && items.length === 0 && (
        <div className="text-[var(--muted-foreground)]">执行中…</div>
      )}
      {items.length > 500 && (
        <div className="text-[var(--warning)]">输出过长，仅显示最近 500 条</div>
      )}
      {items.slice(-500).map((item, i) => (
        <RWorkbenchOutputItem key={i} item={item} />
      ))}
      {images.map((img, i) => (
        <div key={`img-${i}`} className="pt-1">
          <RWorkbenchImage image={img} />
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}