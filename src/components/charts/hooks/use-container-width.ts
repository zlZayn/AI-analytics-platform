import { useState, useEffect } from "react"

/**
 * Track container width via ResizeObserver.
 * Returns current width in pixels (default 500).
 */
export function useContainerWidth(
  ref: React.RefObject<HTMLDivElement | null>,
) {
  const [width, setWidth] = useState(500)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        if (w > 0) setWidth(w)
      }
    })
    observer.observe(el)

    if (el.clientWidth > 0) setWidth(el.clientWidth)

    return () => observer.disconnect()
  }, [ref])

  return width
}
