export interface VirtualWindow {
  start: number
  end: number
  paddingTop: number
  paddingBottom: number
}

export function calculateVirtualWindow(
  rowCount: number,
  viewportHeight: number,
  rowHeight: number,
  scrollTop: number,
  overscan: number,
): VirtualWindow {
  if (rowCount <= 0) return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 }
  const visibleCount = Math.ceil(viewportHeight / rowHeight)
  const maxScrollTop = Math.max(0, rowCount * rowHeight - viewportHeight)
  const firstVisible = Math.floor(Math.min(Math.max(0, scrollTop), maxScrollTop) / rowHeight)
  const start = Math.max(0, firstVisible - overscan)
  const end = Math.min(rowCount, firstVisible + visibleCount + overscan)
  return {
    start,
    end,
    paddingTop: start * rowHeight,
    paddingBottom: (rowCount - end) * rowHeight,
  }
}
