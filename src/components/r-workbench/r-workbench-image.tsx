"use client"

import { useEffect, useRef } from "react"

/**
 * ggplot2 输出图：ImageBitmap 绘制到独立 canvas。
 *
 * 所有权：**bitmap 归 WebRClient**（它在 clearOutput/destroy 时统一 close），
 * 组件不能 close —— 否则 effect 重跑（StrictMode 双跑、重挂载）第二次画的是已关闭位图，
 * canvas 会退回默认 300×150 的空白带边框块（曾出现的"一大片空白"就是这个）。
 */
export function RWorkbenchImage({ image }: { image: ImageBitmap }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // 已关闭/零尺寸位图：不画，避免留下默认尺寸的空白画布
    if (image.width === 0 || image.height === 0) {
      canvas.width = 0
      canvas.height = 0
      return
    }
    canvas.width = image.width
    canvas.height = image.height
    canvas.getContext("2d")?.drawImage(image, 0, 0)
  }, [image])

  return <canvas ref={canvasRef} className="max-w-full rounded border border-[var(--border)]" />
}