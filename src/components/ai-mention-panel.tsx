"use client"

import { Table } from "lucide-react"
import type { MentionTable } from "@/lib/mention"

interface AiMentionPanelProps {
  tables: MentionTable[]
  activeIndex: number
  onSelect: (name: string) => void
  onHoverIndex: (index: number) => void
  panelRef: React.RefObject<HTMLDivElement | null>
  /** 面板 DOM id（与输入框 aria-controls/aria-activedescendant 关联） */
  id: string
}

/** @ 提及下拉面板：键盘高亮 + 鼠标悬停/点选（listbox/option 语义）。 */
export function AiMentionPanel({ tables, activeIndex, onSelect, onHoverIndex, panelRef, id }: AiMentionPanelProps) {
  if (tables.length === 0) return null

  return (
    <div
      ref={panelRef}
      id={id}
      role="listbox"
      aria-label="选择要分析的表"
      className="absolute bottom-full left-0 right-0 mb-1 max-h-52 overflow-auto rounded-md border border-[var(--border)] bg-[var(--popover)] shadow-lg z-50 py-1"
    >
      {tables.map((t, i) => (
        <button
          key={t.name}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          id={`${id}-option-${i}`}
          onMouseEnter={() => onHoverIndex(i)}
          onClick={() => onSelect(t.name)}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
            i === activeIndex
              ? "bg-[var(--accent)] text-[var(--foreground)]"
              : "text-[var(--foreground)] hover:bg-[var(--accent)]"
          }`}
        >
          <Table className="w-3 h-3 shrink-0 text-[var(--muted-foreground)]" />
          <span className="font-mono truncate">{t.name}</span>
          <span className="ml-auto text-[9px] text-[var(--muted-foreground)] shrink-0">{t.columns.length} 列</span>
        </button>
      ))}
    </div>
  )
}