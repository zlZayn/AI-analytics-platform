"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartConfigPanel } from "@/components/chart-config-panel"
import { type ChartMapping } from "@/components/chart"
import type { QueryResult } from "@/types"
import { Copy, Check } from "lucide-react"
import { useToast } from "@/components/toast"

interface Props {
  result: QueryResult
  onCopySql: (sql: string) => void
}

export function ResultPanel({ result, onCopySql }: Props) {
  const { toast } = useToast()
  const [chartMapping, setChartMapping] = useState<ChartMapping>({ chartType: "table" })
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    onCopySql("")
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)]">
        <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)] font-mono">
          <span>{result.rowCount} 行</span>
          <span className="text-[var(--border)]">|</span>
          <span>{result.executionTimeMs}ms</span>
          <span className="text-[var(--border)]">|</span>
          <span>{result.columns.length} 列</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-[11px] text-[var(--muted-foreground)]"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied ? "已复制" : "复制 SQL"}
        </Button>
      </div>

      {/* Chart config + render */}
      <div className="p-3">
        <ChartConfigPanel
          columns={result.columns}
          data={result.rows}
          mapping={chartMapping}
          onChange={setChartMapping}
        />
      </div>
    </div>
  )
}
