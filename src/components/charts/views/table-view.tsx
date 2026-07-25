"use client"

import React, { useMemo } from "react"
import { formatNumber } from "../utils"

export const TableView = React.memo(function TableView({
  data,
  columns,
}: {
  data: Record<string, unknown>[]
  columns: string[]
}) {
  const displayData = useMemo(() => data.slice(0, 100), [data])

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[var(--muted)]">
          <tr className="border-b">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, i) => (
            <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--accent)]">
              {columns.map((col) => {
                const val = row[col]
                const formatted =
                  typeof val === "number"
                    ? formatNumber(val)
                    : String(val ?? "")
                return (
                  <td
                    key={col}
                    className="px-3 py-1.5 text-xs text-[var(--muted-foreground)]"
                  >
                    {formatted}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 100 && (
        <div className="border-t border-[var(--border)] px-3 py-2 text-center text-xs text-[var(--muted-foreground)]">
          显示前 100 行，共 {data.length} 行
        </div>
      )}
    </div>
  )
})
