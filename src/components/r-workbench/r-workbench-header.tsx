"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RWorkbenchHeaderProps {
  rowCount: number
  colCount: number
  onClose: () => void
}

/** R 工作台头部：面板身份 + 数据规模 + 关闭（面板唯一的一级操作）。 */
export function RWorkbenchHeader({ rowCount, colCount, onClose }: RWorkbenchHeaderProps) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--muted)] px-3">
      <div className="min-w-0">
        <span className="text-xs font-medium text-[var(--foreground)]">R 分析 · df（{rowCount} 行 × {colCount} 列）</span>
        <span className="ml-2 hidden text-[10px] text-[var(--muted-foreground)] sm:inline">隔离在浏览器沙箱，输出不回写分析会话</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 gap-1 text-[11px]"
        onClick={onClose}
        aria-label="关闭 R 分析工作台"
        title="关闭（Esc）"
      >
        <X className="w-3 h-3" /> 关闭
      </Button>
    </header>
  )
}
