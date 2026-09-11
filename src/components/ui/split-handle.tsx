"use client"

// 可拖拽分割句柄（统一实现，三处复用：工作台纵向 / 工作台横向 / R 面板纵向）
//
// 交互契约：
// - 指针拖拽改比例（受控：调用方持有比例与持久化）
// - 键盘可达：方向键微调 5%，Home 复位
// - 双击复位；focus-visible 有明确描边
// 无业务状态（ui/ 规则）：比例、边界、容器都由 props 注入。

import type * as React from "react"
import { cn } from "@/lib/utils"
import { clampRatio, type SplitAxis, type SplitBounds } from "@/lib/split"

interface SplitHandleProps {
  /** 拖动方向：y = 上下（改高度），x = 左右（改宽度） */
  axis: SplitAxis
  /** 当前比例（前一块占容器可用尺寸的比例） */
  ratio: number
  bounds: SplitBounds
  /** 拖拽中实时更新 */
  onPreview: (ratio: number) => void
  /** 松手后写回 */
  onCommit: () => void
  /** 双击 / Home 复位 */
  onReset: () => void
  /** 计算比例的容器（前一块所在容器） */
  containerRef: React.RefObject<HTMLElement | null>
  /** 拖拽方向占用的像素，需与句柄视觉厚度一致 */
  thickness?: number
  /** 比例从对侧量起（如右侧停靠面板：往左拖变宽） */
  invert?: boolean
  label: string
  className?: string
}

const KEY_STEP = 0.05

export function SplitHandle({
  axis,
  ratio,
  bounds,
  onPreview,
  onCommit,
  onReset,
  containerRef,
  thickness = 20,
  invert = false,
  label,
  className,
}: SplitHandleProps) {
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const container = containerRef.current
    if (!container) return
    event.preventDefault()
    const rect = container.getBoundingClientRect()
    const usable = (axis === "y" ? rect.height : rect.width) - thickness
    const move = (pointerEvent: PointerEvent) => {
      if (usable <= 0) return
      const offset = axis === "y" ? pointerEvent.clientY - rect.top : pointerEvent.clientX - rect.left
      const position = offset / usable
      onPreview(clampRatio(invert ? 1 - position : position, ratio, bounds))
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      onCommit()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop, { once: true })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const decrease = axis === "y" ? "ArrowUp" : "ArrowLeft"
    const increase = axis === "y" ? "ArrowDown" : "ArrowRight"
    if (event.key === decrease || event.key === increase) {
      const step = event.key === increase ? KEY_STEP : -KEY_STEP
      onPreview(clampRatio(ratio + (invert ? -step : step), ratio, bounds))
      onCommit()
      event.preventDefault()
    } else if (event.key === "Home") {
      onReset()
      event.preventDefault()
    }
  }

  return (
    <div
      role="separator"
      aria-orientation={axis === "y" ? "horizontal" : "vertical"}
      aria-label={label}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex shrink-0 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        axis === "y" ? "h-5 cursor-row-resize" : "w-2 cursor-col-resize self-stretch",
        className,
      )}
    >
      <span
        className={cn(
          "rounded bg-[var(--border)] transition-colors group-hover:bg-[var(--ring)] group-focus-visible:bg-[var(--ring)]",
          axis === "y" ? "h-0.5 w-10" : "h-10 w-0.5",
        )}
      />
    </div>
  )
}
