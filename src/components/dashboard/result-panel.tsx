"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChartConfigPanel } from "@/components/chart-config-panel"
import { type ChartMapping } from "@/components/chart"
import type { QueryResult } from "@/types"
import { Copy, Check } from "lucide-react"

interface Props {
  result: QueryResult
  onCopySql: () => void
  initialMapping?: ChartMapping
  /** 受控模式：由父组件持有 mapping，变化时通过 onMappingChange 回传 */
  mapping?: ChartMapping
  onMappingChange?: (mapping: ChartMapping) => void
}

const DEFAULT_MAPPING: ChartMapping = { chartType: "table" }

export function ResultPanel({ result, onCopySql, initialMapping, mapping: controlledMapping, onMappingChange }: Props) {
  const initial = initialMapping || DEFAULT_MAPPING
  const [chartState, setChartState] = useState<{ result: QueryResult; initial: ChartMapping; mapping: ChartMapping }>({
    result,
    initial,
    mapping: initial,
  })
  const [copied, setCopied] = useState(false)
  const controlled = controlledMapping !== undefined
  const chartMapping = controlled
    ? controlledMapping
    : chartState.result === result && chartState.initial === initial
      ? chartState.mapping
      : initial

  function handleMapping(mapping: ChartMapping) {
    if (controlled) {
      onMappingChange?.(mapping)
    } else {
      setChartState({ result, initial, mapping })
    }
  }

  function handleCopy() {
    onCopySql()
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
          {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3" />}
          {copied ? "已复制" : "复制 SQL"}
        </Button>
      </div>

      {/* Chart config + render */}
      <div className="p-3">
        <ChartConfigPanel
          columns={result.columns}
          data={result.rows}
          mapping={chartMapping}
          onChange={handleMapping}
        />
      </div>
    </div>
  )
}
