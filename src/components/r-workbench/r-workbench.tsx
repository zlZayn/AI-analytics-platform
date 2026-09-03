"use client"

import { useEffect, useRef, useState } from "react"
import { RWorkbenchHeader } from "./r-workbench-header"
import { RWorkbenchToolbar } from "./r-workbench-toolbar"
import { RWorkbenchEditor } from "./r-workbench-editor"
import { RWorkbenchOutput } from "./r-workbench-output"
import { RWorkbenchStatusBar } from "./r-workbench-status-bar"
import { useWebR } from "@/hooks/useWebR"
import { generateRTemplate } from "@/lib/r-bridge"
import { withTimeout } from "@/lib/webr-client"
import type { SemanticDataset } from "@/types/session"

interface RWorkbenchProps {
  dataset: SemanticDataset
  open: boolean
  onClose: () => void
}

/**
 * R 分析工作台（内嵌区块，置于结果区下方）：
 * - open 时懒加载 WebR、注入数据、填充模板
 * - 模板已手动修改则不覆盖
 * - 快捷键：Ctrl+Enter 运行 / Esc 关闭 / Ctrl+Shift+C 清空 / Ctrl+Shift+E 中断
 */
export function RWorkbench({ dataset, open, onClose }: RWorkbenchProps) {
  const webR = useWebR()
  const [code, setCode] = useState("")
  const [injectedFor, setInjectedFor] = useState<SemanticDataset | null>(null)
  const initializedRef = useRef(false)

  // actions 为稳定引用（useWebR useMemo）；effect 依赖它们不会因渲染变化重触发
  const { init, ensurePackages, injectData, clearOutput, interrupt, execute } = webR

  // 打开时：初始化 WebR + 注入数据 + 填充模板
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function bootstrap() {
      try {
        await init()
        if (cancelled) return
        await ensurePackages(["dplyr", "ggplot2"])
        if (cancelled) return
        await injectData(dataset)
        if (cancelled) return
        setInjectedFor(dataset)
        setCode((prev) => {
          // 模板已修改（非空且非上次模板）→ 不覆盖
          if (prev.trim().length > 0 && prev !== generateRTemplate(dataset)) return prev
          return generateRTemplate(dataset)
        })
      } catch {
        // init/inject 失败：状态显示在 status bar（WebR status error）
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [open, dataset, init, ensurePackages, injectData])

  // 数据集变化且工作台已打开：重新注入（维护已打开状态下的数据新鲜度）
  useEffect(() => {
    if (!open || !initializedRef.current) return
    let cancelled = false
    void (async () => {
      try {
        await injectData(dataset)
        if (!cancelled) setInjectedFor(dataset)
      } catch {
        // 静默：下次运行仍可用旧数据
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, dataset, injectData])

  useEffect(() => {
    initializedRef.current = webR.status === "ready"
  }, [webR.status])

  // 快捷键
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault()
        clearOutput()
        return
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault()
        void interrupt()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onClose, clearOutput, interrupt])

  async function handleRun() {
    try {
      await withTimeout(execute(code), 60_000)
    } catch {
      // 超时：WebRClient 内部已输出 error；此处尝试中断
      await interrupt()
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
  }

  if (!open) return null

  return (
    <div className="rounded-lg border border-[var(--border)] mt-3 overflow-hidden">
      <RWorkbenchHeader
        rowCount={dataset.rows.length}
        colCount={dataset.columns.length}
        onClose={onClose}
      />
      <RWorkbenchToolbar
        busy={webR.busy}
        onRun={handleRun}
        onInterrupt={() => void interrupt()}
        onClear={clearOutput}
        onCopy={handleCopy}
        canInterrupt={true}
      />
      <div className="p-2 space-y-2">
        <RWorkbenchEditor value={code} onChange={setCode} onRun={handleRun} />
        <RWorkbenchOutput items={webR.output} images={webR.images} busy={webR.busy} />
      </div>
      <RWorkbenchStatusBar packages={webR.packages} lastExecMs={webR.lastExecMs} busy={webR.busy} />
      {injectedFor === null && webR.status === "ready" && (
        <div className="px-3 pb-1 text-[10px] text-[var(--muted-foreground)]">
          数据注入中…（首次加载 R 运行时约 8MB，包下载后自动继续）
        </div>
      )}
    </div>
  )
}