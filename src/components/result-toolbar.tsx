"use client"

import { useEffect, useRef, useState } from "react"
import { Download, FileJson, Copy, FlaskConical, ChevronDown } from "lucide-react"
import { exportCSV, generateRTemplate } from "@/lib/r-bridge"
import type { SemanticDataset } from "@/types/session"

interface ResultToolbarProps {
  dataset: SemanticDataset
  onOpenRWorkbench?: () => void
}

/** 结果工具条（收敛为「导出 ▼」下拉）：导出 CSV/JSON、复制 R 模板、（P1）打开 R 分析工作台。 */
export function ResultToolbar({ dataset, onOpenRWorkbench }: ResultToolbarProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // 外部点击关闭（mousedown 早于 click，避免与菜单项点击竞争）
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node
      if (rootRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

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
    setOpen(false)
  }

  function exportJson() {
    const json = JSON.stringify(dataset, null, 2)
    download(new Blob([json], { type: "application/json" }), `query-result-${Date.now()}.json`)
    setOpen(false)
  }

  async function copyRTemplate() {
    const code = generateRTemplate(dataset)
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setOpen(false)
    setTimeout(() => setCopied(false), 1500)
  }

  const itemCls =
    "w-full flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
      >
        <Download className="w-3 h-3" /> 导出
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="导出与高级操作"
          className="absolute right-0 top-full mt-1 z-50 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <button
            type="button"
            role="menuitem"
            className={itemCls}
            onClick={exportCsv}
            title="导出 CSV（带 UTF-8 BOM，Excel 中文兼容）"
          >
            <Download className="w-3.5 h-3.5 text-[var(--muted-foreground)]" /> 导出 CSV
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemCls}
            onClick={exportJson}
            title="导出 JSON"
          >
            <FileJson className="w-3.5 h-3.5 text-[var(--muted-foreground)]" /> 导出 JSON
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemCls}
            onClick={copyRTemplate}
            title="复制 R 代码模板（dplyr + ggplot2，可在 RStudio 运行）"
          >
            <Copy className="w-3.5 h-3.5 text-[var(--muted-foreground)]" /> {copied ? "已复制" : "复制 R 模板"}
          </button>
          {onOpenRWorkbench && (
            <button
              type="button"
              role="menuitem"
              className={itemCls}
              onClick={() => {
                setOpen(false)
                onOpenRWorkbench()
              }}
              title="在浏览器中用 R 分析（WebR）"
            >
              <FlaskConical className="w-3.5 h-3.5 text-[var(--muted-foreground)]" /> R 分析
            </button>
          )}
        </div>
      )}
    </div>
  )
}