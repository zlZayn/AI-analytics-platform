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
        <thead className="sticky top-0 bg-gray-50">
          <tr className="border-b">
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-3 py-2 font-medium text-gray-700 text-xs"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, i) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              {columns.map((col) => {
                const val = row[col]
                const formatted =
                  typeof val === "number"
                    ? formatNumber(val)
                    : String(val ?? "")
                return (
                  <td
                    key={col}
                    className="px-3 py-1.5 text-gray-600 text-xs"
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
        <div className="text-xs text-gray-400 px-3 py-2 text-center border-t">
          显示前 100 行，共 {data.length} 行
        </div>
      )}
    </div>
  )
})
