"use client"

import React, { useMemo, useRef, useState } from "react"
import { formatNumber } from "../utils"
import { calculateVirtualWindow } from "../table-virtualization"

const ROW_HEIGHT = 32
const VIEWPORT_HEIGHT = 400
const OVERSCAN = 6
const DEFAULT_COLUMN_WIDTH = 160
const MIN_COLUMN_WIDTH = 96
const MAX_COLUMN_WIDTH = 360

type ColumnWidths = Record<string, number>

export const TableView = React.memo(function TableView({
  data,
  columns,
}: {
  data: Record<string, unknown>[]
  columns: string[]
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const storageKey = useMemo(() => `analytics-table-widths:${columns.join("|")}`, [columns])
  const [widthsByKey, setWidthsByKey] = useState<Record<string, ColumnWidths>>({})
  const [scrollTop, setScrollTop] = useState(0)
  const persistedWidths = useMemo(() => readColumnWidths(storageKey), [storageKey])
  const storedWidths = widthsByKey[storageKey] ?? persistedWidths
  const widths = columns.reduce<ColumnWidths>((result, column) => {
    result[column] = storedWidths[column] ?? DEFAULT_COLUMN_WIDTH
    return result
  }, {})
  const virtual = calculateVirtualWindow(data.length, VIEWPORT_HEIGHT, ROW_HEIGHT, scrollTop, OVERSCAN)
  const visibleRows = data.slice(virtual.start, virtual.end)
  const tableWidth = columns.reduce((total, column) => total + widths[column], 0)

  function updateColumnWidth(column: string, width: number) {
    const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(width)))
    setWidthsByKey((current) => {
      const next = { ...(current[storageKey] ?? storedWidths), [column]: nextWidth }
      writeColumnWidths(storageKey, next)
      return { ...current, [storageKey]: next }
    })
  }

  function startResize(event: React.PointerEvent, column: string) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = widths[column]
    const move = (pointerEvent: PointerEvent) => updateColumnWidth(column, startWidth + pointerEvent.clientX - startX)
    const stop = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop, { once: true })
  }

  function handleKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const viewport = viewportRef.current
    if (!viewport) return
    const movement: Partial<Record<string, number>> = {
      ArrowDown: ROW_HEIGHT,
      ArrowUp: -ROW_HEIGHT,
      PageDown: VIEWPORT_HEIGHT,
      PageUp: -VIEWPORT_HEIGHT,
    }
    if (event.key in movement) viewport.scrollBy({ top: movement[event.key], behavior: "auto" })
    else if (event.key === "Home") viewport.scrollTo({ top: 0, behavior: "auto" })
    else if (event.key === "End") viewport.scrollTo({ top: data.length * ROW_HEIGHT, behavior: "auto" })
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={viewportRef}
      className="max-h-[400px] overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      tabIndex={0}
      aria-label={`查询结果，共 ${data.length} 行 ${columns.length} 列`}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={handleKeyboard}
    >
      <table className="table-fixed text-sm" style={{ width: tableWidth }}>
        <colgroup>{columns.map((column) => <col key={column} style={{ width: widths[column] }} />)}</colgroup>
        <thead className="sticky top-0 z-10 bg-[var(--muted)] shadow-[0_1px_0_var(--border)]">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="relative h-8 overflow-hidden px-3 text-left text-xs font-medium text-[var(--foreground)]">
                <span className="block truncate" title={column}>{column}</span>
                <button
                  type="button"
                  aria-label={`调整 ${column} 列宽`}
                  className="absolute inset-y-0 right-0 w-3 cursor-col-resize touch-none border-r border-transparent hover:border-[var(--ring)] focus-visible:border-[var(--ring)] focus-visible:outline-none"
                  onPointerDown={(event) => startResize(event, column)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
                    updateColumnWidth(column, widths[column] + (event.key === "ArrowRight" ? 16 : -16))
                    event.preventDefault()
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {virtual.paddingTop > 0 && <SpacerRow columns={columns.length} height={virtual.paddingTop} />}
          {visibleRows.map((row, offset) => {
            const rowIndex = virtual.start + offset
            return (
              <tr key={rowIndex} data-row-index={rowIndex} style={{ height: ROW_HEIGHT }} className="border-b border-[var(--border)] hover:bg-[var(--accent)]">
                {columns.map((column) => <DataCell key={column} value={row[column]} />)}
              </tr>
            )
          })}
          {virtual.paddingBottom > 0 && <SpacerRow columns={columns.length} height={virtual.paddingBottom} />}
        </tbody>
      </table>
    </div>
  )
})

function DataCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <td className="truncate px-3 py-1.5 text-xs"><span aria-label="空值" className="font-mono text-[10px] text-[var(--muted-foreground)] opacity-70">NULL</span></td>
  }
  const formatted = typeof value === "number" ? formatNumber(value) : String(value)
  return <td className="truncate px-3 py-1.5 text-xs text-[var(--muted-foreground)]" title={formatted}>{formatted}</td>
}

function SpacerRow({ columns, height }: { columns: number; height: number }) {
  return <tr aria-hidden="true"><td colSpan={columns} style={{ height, padding: 0, border: 0 }} /></tr>
}

function readColumnWidths(key: string): ColumnWidths {
  if (typeof window === "undefined") return {}
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "{}")
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])))
  } catch {
    return {}
  }
}

function writeColumnWidths(key: string, widths: ColumnWidths) {
  try {
    window.localStorage.setItem(key, JSON.stringify(widths))
  } catch {
    // Storage may be unavailable in private browsing; resizing still works in memory.
  }
}
