"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { extractPendingMention, filterTables, replaceMention, type MentionTable } from "@/lib/mention"

export interface UseMentionInputOptions {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  tables: MentionTable[]
}

export interface UseMentionInputResult {
  mentionOpen: boolean
  activeIndex: number
  filtered: MentionTable[]
  inputRef: React.RefObject<HTMLInputElement | null>
  panelRef: React.RefObject<HTMLDivElement | null>
  select: (name: string) => void
  close: () => void
  handleInputChange: (next: string) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onHoverIndex: (index: number) => void
}

/**
 * AI 提及输入状态机：
 * - 面板开关是派生值：正在输入 @ 词 且 未被外部点击 dismissed → 打开
 * - 所有状态转变都在事件处理器中（无渲染期 setState / ref 访问）
 * - 键盘 ↑↓ 导航、Enter/Tab 选中、Escape 关闭；Enter（无面板）提交
 */
export function useMentionInput({
  value,
  onChange,
  onSend,
  tables,
}: UseMentionInputOptions): UseMentionInputResult {
  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const pendingMention = useMemo(() => extractPendingMention(value), [value])
  const hasMention = pendingMention !== null

  const filtered = useMemo(
    () => filterTables(tables, pendingMention ?? ""),
    [tables, pendingMention]
  )

  // 派生：正在输入 @ 词 且 未被外部点击关闭 且 有候选 → 打开面板
  const mentionOpen = hasMention && !dismissed && filtered.length > 0

  // 点击面板/输入框外部时关闭
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (inputRef.current?.contains(t)) return
      setDismissed(true)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  /** 用户输入：转发值变化，并重置面板状态（新输入即重新交互）。 */
  const handleInputChange = useCallback(
    (next: string) => {
      onChange(next)
      setDismissed(false)
      setActiveIndex(0)
    },
    [onChange]
  )

  const select = useCallback(
    (name: string) => {
      onChange(replaceMention(value, name))
      setDismissed(false)
      inputRef.current?.focus()
    },
    [value, onChange]
  )

  const close = useCallback(() => setDismissed(true), [])

  const onHoverIndex = useCallback((index: number) => setActiveIndex(index), [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (mentionOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setActiveIndex((i) => (i + 1) % filtered.length)
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
          return
        }
        if (e.key === "Enter" || e.key === "Tab") {
          const picked = filtered[activeIndex]
          if (picked) {
            e.preventDefault()
            select(picked.name)
            return
          }
        }
        if (e.key === "Escape") {
          e.preventDefault()
          setDismissed(true)
          return
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        onSend()
      }
    },
    [mentionOpen, filtered, activeIndex, select, onSend]
  )

  return {
    mentionOpen,
    activeIndex,
    filtered,
    inputRef,
    panelRef,
    select,
    close,
    handleInputChange,
    handleKeyDown,
    onHoverIndex,
  }
}