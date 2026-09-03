"use client"

import { useState } from "react"
import { Download, FileJson, Copy, FlaskConical } from "lucide-react"
import { exportCSV, generateRTemplate } from "@/lib/r-bridge"
import type { SemanticDataset } from "@/types/session"

interface ResultToolbarProps {
  dataset: SemanticDataset
  onOpenRWorkbench?: () => void
}

/** 结果工具条：导出 CSV/JSON、复制 R 模板、（P1）打开 R 分析工作台。 */
export function ResultToolbar({ dataset, onOpenRWorkbench }: ResultToolbarProps) {
  const [copied, setCopied] = useState(false)

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCsv() {
    const csv = exportCSV(dataset)
    download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `query-result-${Date.now()}.csv`)
  }

  function exportJson() {
    const json = JSON.stringify(dataset, null, 2)
    download(new Blob([json], { type: "application/json" }), `query-result-${Date.now()}.json`)
  }

  async function copyRTemplate() {
    const code = generateRTemplate(dataset)
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const btnCls =
    "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors cursor-pointer"

  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={btnCls} onClick={exportCsv} title="导出 CSV（带 UTF-8 BOM，Excel 中文兼容）">
        <Download className="w-3 h-3" /> CSV
      </button>
      <button type="button" className={btnCls} onClick={exportJson} title="导出 JSON">
        <FileJson className="w-3 h-3" /> JSON
      </button>
      <button type="button" className={btnCls} onClick={copyRTemplate} title="复制 R 代码模板（dplyr + ggplot2，可在 RStudio 运行）">
        <Copy className="w-3 h-3" /> {copied ? "已复制" : "R 模板"}
      </button>
      {onOpenRWorkbench && (
        <button type="button" className={btnCls} onClick={onOpenRWorkbench} title="在浏览器中用 R 分析（WebR，P1）">
          <FlaskConical className="w-3 h-3" /> R 分析
        </button>
      )}
    </div>
  )
}