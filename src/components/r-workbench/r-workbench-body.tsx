"use client"

// R 工作台内容区：代码编辑器 + 可拖拽分割条 + 输出，纵向比例由本组件持有。
// 面板其余三段（头部 / 工具栏 / 状态栏）不参与；比例预设与记忆走 SPLIT_PRESETS.rWorkbench（本地存储）。

import { useRef } from "react"
import { RWorkbenchEditor } from "./r-workbench-editor"
import { RWorkbenchOutput } from "./r-workbench-output"
import { SplitHandle } from "@/components/ui/split-handle"
import { useSplitRatio } from "@/hooks/useSplitRatio"
import { SPLIT_PRESETS } from "@/lib/split"
import type { ROutputItem } from "@/lib/webr-client"

interface RWorkbenchBodyProps {
  code: string
  onCodeChange: (value: string) => void
  onRun: () => void
  items: ROutputItem[]
  images: ImageBitmap[]
  busy: boolean
}

export function RWorkbenchBody({ code, onCodeChange, onRun, items, images, busy }: RWorkbenchBodyProps) {
  const panelSplit = useSplitRatio(
    SPLIT_PRESETS.rWorkbench.key,
    SPLIT_PRESETS.rWorkbench.defaultRatio,
    SPLIT_PRESETS.rWorkbench.bounds,
  )
  const contentRef = useRef<HTMLDivElement | null>(null)

  // 内容区：代码与输出按可拖拽比例分配高度，各自内部滚动（消除「挤压成细长条」）
  return (
    <div ref={contentRef} className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
      <section
        aria-label="R 代码"
        style={{ flexGrow: panelSplit.ratio, flexBasis: 0 }}
        className="flex min-h-[180px] flex-col overflow-hidden rounded-md border border-[var(--border)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--muted)] px-2 py-1">
          <span className="text-[10px] font-medium text-[var(--muted-foreground)]">代码（df 已注入当前结果集）</span>
          <span className="hidden text-[10px] text-[var(--muted-foreground)] sm:inline">Ctrl+Enter 运行</span>
        </div>
        <div className="min-h-0 flex-1">
          <RWorkbenchEditor value={code} onChange={onCodeChange} onRun={onRun} />
        </div>
      </section>

      <SplitHandle
        axis="y"
        ratio={panelSplit.ratio}
        bounds={SPLIT_PRESETS.rWorkbench.bounds}
        onPreview={panelSplit.preview}
        onCommit={panelSplit.commit}
        onReset={panelSplit.reset}
        containerRef={contentRef}
        label="调整代码与输出高度（双击或 Home 复位）"
      />

      <section
        aria-label="R 输出"
        style={{ flexGrow: 1 - panelSplit.ratio, flexBasis: 0 }}
        className="flex min-h-[120px] flex-col overflow-hidden rounded-md border border-[var(--border)]"
      >
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--muted)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)]">
          输出
        </div>
        <div className="min-h-0 flex-1">
          <RWorkbenchOutput items={items} images={images} busy={busy} />
        </div>
      </section>
    </div>
  )
}
