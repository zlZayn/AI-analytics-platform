"use client"

import { useEffect, useRef, useState } from "react"
import { RWorkbenchOutputItem } from "./r-workbench-output-item"
import { RWorkbenchImage } from "./r-workbench-image"
import type { ROutputItem } from "@/lib/webr-client"

interface RWorkbenchOutputProps {
  items: ROutputItem[]
  images: ImageBitmap[]
  busy: boolean
}

const PIN_THRESHOLD_PX = 40

/** R 输出流容器：分级渲染 + aria-live + 自动滚底（用户上滚后暂停，回底恢复）。 */
export function RWorkbenchOutput({ items, images, busy }: RWorkbenchOutputProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const [pinned, setPinned] = useState(true)

  // 滚动位置决定 pinned：距底部 ≤40px 视为钉在底部；用户上滚即离开
  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_THRESHOLD_PX)
  }

  // 新输出到达且钉在底部时自动滚底；恢复钉住时立即滚到底
  useEffect(() => {
    if (!pinned) return
    endRef.current?.scrollIntoView({ block: "end" })
  }, [items.length, images.length, pinned])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
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
      {items.slice(-500).map((item) => (
        <RWorkbenchOutputItem key={item.id} item={item} />
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