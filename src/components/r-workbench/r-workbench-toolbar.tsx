"use client"

import { Play, Square, Eraser, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RWorkbenchToolbarProps {
  busy: boolean
  onRun: () => void
  onInterrupt: () => void
  onClear: () => void
  onCopy: () => void
  canInterrupt: boolean
}

/** R 工作台工具栏：运行 / 中断 / 清空 / 复制；窄屏自动换行，不再挤压。 */
export function RWorkbenchToolbar({
  busy,
  onRun,
  onInterrupt,
  onClear,
  onCopy,
  canInterrupt,
}: RWorkbenchToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--border)] px-3 py-2">
      <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={onRun} disabled={busy} title="运行（Ctrl+Enter）">
        <Play className="w-3 h-3" /> 运行
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-[11px]"
        onClick={onInterrupt}
        disabled={!busy || !canInterrupt}
        title={canInterrupt ? "中断执行（Ctrl+Shift+E）" : "当前通道不支持中断"}
      >
        <Square className="w-3 h-3" /> 中断
      </Button>
      <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={onClear} title="清空输出（Ctrl+Shift+C）">
        <Eraser className="w-3 h-3" /> 清空
      </Button>
      <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1 text-[11px]" onClick={onCopy} title="复制 R 代码">
        <Copy className="w-3 h-3" /> 复制
      </Button>
    </div>
  )
}
