"use client"

// 分割比例状态（受控句柄的宿主）
//
// preview = 拖拽过程中的实时值（不写盘，避免 pointermove 高频写 localStorage）
// commit  = 松手/键盘操作后写盘
// reset   = 回到默认比例（双击或 Home）

import { useCallback, useRef, useState } from "react"
import { clampRatio, readStoredRatio, writeStoredRatio, type SplitBounds } from "@/lib/split"

export interface SplitRatio {
  ratio: number
  /** 拖拽中：只更新状态 */
  preview: (next: number) => void
  /** 松手/键盘操作：把当前值写回本地 */
  commit: () => void
  /** 复位到默认比例并写回 */
  reset: () => void
}

export function useSplitRatio(key: string, defaultRatio: number, bounds: SplitBounds): SplitRatio {
  const [ratio, setRatio] = useState(() => readStoredRatio(key, defaultRatio, bounds))
  const ratioRef = useRef(ratio)

  const { min, max } = bounds
  const preview = useCallback(
    (next: number) => {
      const clamped = clampRatio(next, defaultRatio, { min, max })
      ratioRef.current = clamped
      setRatio(clamped)
    },
    [defaultRatio, min, max],
  )

  const commit = useCallback(() => {
    writeStoredRatio(key, ratioRef.current)
  }, [key])

  const reset = useCallback(() => {
    ratioRef.current = defaultRatio
    setRatio(defaultRatio)
    writeStoredRatio(key, defaultRatio)
  }, [key, defaultRatio])

  return { ratio, preview, commit, reset }
}
