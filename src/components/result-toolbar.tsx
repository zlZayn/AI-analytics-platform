"use client"

import { useEffect, useRef, useState } from "react"
import { Download, FileJson, Copy, FlaskConical, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportCSV, generateRTemplate } from "@/lib/r-bridge"
import type { SemanticDataset } from "@/types/session"

interface ResultToolbarProps {
  dataset: SemanticDataset
  onOpenRWorkbench?: () => void
}

// 层级：**R 分析是一级动作**（就地在此页开一个分析环境），
// 「导出 ▼」只放"把数据/代码带走"的三项。原先把 R 分析塞进导出菜单，动作与导出混为一类。
// 决策见 .agents/notes/2026-09-11-result-toolbar-export-vs-actions.md

function MenuItem({
  icon,
  label,
  description,
  title,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      title={title}
      className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-[11px] text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] cursor-pointer"
    >
      <span className="mt-0.5 text-[var(--muted-foreground)]">{icon}</span>
      <span className="min-w-0">
        <span className="block">{label}</span>
        <span className="block text-[10px] text-[var(--muted-foreground)]">{description}</span>
      </span>
    </button>
  )
}

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

  return (
    <div ref={rootRef} className="flex items-center gap-2">
      {onOpenRWorkbench && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 text-[10px]"
          onClick={onOpenRWorkbench}
          title="在浏览器内运行 R（WebR）：当前结果注入为 df，可写 dplyr/ggplot2"
        >
          <FlaskConical className="w-3 h-3" /> R 分析
        </Button>
      )}

      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          title="把这份结果带走：CSV / JSON / R 代码模板"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        >
          <Download className="w-3 h-3" /> 导出
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div
            role="menu"
            aria-label="导出数据与代码"
            className="absolute right-0 top-full mt-1 z-50 w-60 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          >
            <MenuItem
              icon={<Download className="w-3.5 h-3.5" />}
              label="导出 CSV"
              description="带 UTF-8 BOM，Excel 打开中文不乱码"
              title="导出 CSV（带 UTF-8 BOM，Excel 中文兼容）"
              onClick={exportCsv}
            />
            <MenuItem
              icon={<FileJson className="w-3.5 h-3.5" />}
              label="导出 JSON"
              description="完整结果集（含列类型与行数元信息）"
              title="导出 JSON"
              onClick={exportJson}
            />
            <MenuItem
              icon={<Copy className="w-3.5 h-3.5" />}
              label={copied ? "已复制 R 模板" : "复制 R 模板"}
              description="dplyr + ggplot2，粘贴到 RStudio 运行"
              title="复制 R 代码模板（dplyr + ggplot2，可在 RStudio 运行）"
              onClick={() => void copyRTemplate()}
            />
          </div>
        )}
      </div>
    </div>
  )
}
