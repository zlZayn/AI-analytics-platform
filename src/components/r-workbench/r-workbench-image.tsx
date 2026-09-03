"use client"

import { useEffect, useRef } from "react"

/** ggplot2 输出图：ImageBitmap 绘制到独立 canvas；unmount 时释放。 */
export function RWorkbenchImage({ image }: { image: ImageBitmap }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = image.width
    canvas.height = image.height
    canvas.getContext("2d")?.drawImage(image, 0, 0)
    return () => image.close()
  }, [image])

  return <canvas ref={canvasRef} className="max-w-full h-auto rounded border border-[var(--border)]" />
}