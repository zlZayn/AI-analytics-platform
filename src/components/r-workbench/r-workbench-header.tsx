"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RWorkbenchHeaderProps {
  rowCount: number
  colCount: number
  onClose: () => void
}

/** R 工作台标题栏：数据集信息 + 关闭（内嵌区块的 muted 头部）。 */
export function RWorkbenchHeader({ rowCount, colCount, onClose }: RWorkbenchHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)]">
      <span className="text-xs font-medium text-[var(--muted-foreground)]">
        R 分析 · df（{rowCount} 行 × {colCount} 列）
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 text-[10px]"
        onClick={onClose}
        aria-label="关闭 R 分析工作台"
        title="关闭（Esc）"
      >
        <X className="w-3 h-3" /> 关闭
      </Button>
    </div>
  )
}