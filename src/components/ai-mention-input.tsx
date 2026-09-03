"use client"

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { AiMentionPanel } from "@/components/ai-mention-panel"
import { useMentionInput } from "@/hooks/useMentionInput"
import type { SchemaData } from "@/types"

interface AiMentionInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  schema?: SchemaData | null
}

/** AI 提及输入框：@ 弹表选择（键盘/鼠标），选中保留 "@表名" 语法作为显式上下文。 */
export function AiMentionInput({ value, onChange, onSend, disabled, placeholder, schema }: AiMentionInputProps) {
  const tables = useMemo(() => schema?.tables ?? [], [schema])

  const {
    mentionOpen,
    activeIndex,
    filtered,
    inputRef,
    panelRef,
    select,
    handleInputChange,
    handleKeyDown,
    onHoverIndex,
  } = useMentionInput({ value, onChange, onSend, tables })

  return (
    <div className="relative flex-1 min-w-0">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="h-7 text-xs"
      />
      {mentionOpen && (
        <AiMentionPanel
          tables={filtered}
          activeIndex={activeIndex}
          onSelect={select}
          onHoverIndex={onHoverIndex}
          panelRef={panelRef}
        />
      )}
    </div>
  )
}