"use client"

// R 分析工作台：右侧停靠面板（sheet）
//
// 定位与取舍（决策见 .agents/notes/2026-09-03-result-area-three-layer-tabs.md）：
// R 是「手段」不是交互主体，因此**不占用结果区布局**——固定定位在右侧，打开时结果区不再被挤压。
//
// 状态与生命周期：
// - 首次打开后保持挂载（关闭只是平移出屏）：代码与输出在关闭/重开之间保留，重开不被重置
// - WebR 仍是模块级单例（useWebR），刷新页面才重置；数据集变化且已打开时重新注入
// - 快捷键：Ctrl+Enter 运行 / Esc 关闭 / Ctrl+Shift+C 清空 / Ctrl+Shift+E 中断

import { useEffect, useRef, useState } from "react"
import type * as React from "react"
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

/** 代码/输出默认占比与边界：代码为主，输出不被压到看不见 */
export const DEFAULT_SPLIT_RATIO = 0.62
const MIN_SPLIT_RATIO = 0.35
const MAX_SPLIT_RATIO = 0.8
const SPLITTER_HEIGHT = 20
const SPLIT_STORAGE_KEY = "analytics-r-workbench-split"

export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPLIT_RATIO
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value))
}

function readSplitRatio(): number {
  if (typeof window === "undefined") return DEFAULT_SPLIT_RATIO
  try {
    const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY)
    return raw === null ? DEFAULT_SPLIT_RATIO : clampSplitRatio(Number(raw))
  } catch {
    return DEFAULT_SPLIT_RATIO
  }
}

function writeSplitRatio(ratio: number): void {
  try {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(ratio))
  } catch {
    // 存储不可用（隐私模式）：本次拖拽仍生效，仅不记忆
  }
}

export function RWorkbench({ dataset, open, onClose }: RWorkbenchProps) {
  const webR = useWebR()
  const [code, setCode] = useState("")
  const [injectedFor, setInjectedFor] = useState<SemanticDataset | null>(null)
  const [splitRatio, setSplitRatio] = useState(() => readSplitRatio())
  const contentRef = useRef<HTMLDivElement | null>(null)
  const splitRef = useRef(splitRatio)
  const initializedRef = useRef(false)

  // actions 为稳定引用（useWebR useMemo）；effect 依赖它们不会因渲染变化重触发
  const { init, ensurePackages, injectData, clearOutput, interrupt, execute, reportError } = webR

  // 打开时：初始化 WebR + 注入数据 + 填充模板
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function bootstrap() {
      // 先给模板：运行时不初始化（离线/CDN 不可用）也能读、改、复制代码
      setCode((prev) => {
        if (prev.trim().length > 0 && prev !== generateRTemplate(dataset)) return prev
        return generateRTemplate(dataset)
      })
      try {
        await init()
        if (cancelled) return
        await ensurePackages(["dplyr", "ggplot2"])
        if (cancelled) return
        await injectData(dataset)
        if (cancelled) return
        setInjectedFor(dataset)
      } catch {
        // init/inject 失败：错误写入输出区（离开「等待运行…」占位），
        // 具体原因经 webR.error 显示在状态栏（此处不读 state，避免 effect 依赖循环）
        reportError("R 环境初始化失败，请检查网络后刷新页面重试")
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [open, dataset, init, ensurePackages, injectData, reportError])

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

  // 快捷键：面板打开时生效；Monaco 已处理的事件（defaultPrevented）不再重复响应
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
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

  /** 拖拽分割：按内容区高度换算代码占比（夹在 35%..80%），松手写回本地 */
  function startSplit(event: React.PointerEvent<HTMLDivElement>) {
    const container = contentRef.current
    if (!container) return
    event.preventDefault()
    const rect = container.getBoundingClientRect()
    const move = (pointerEvent: PointerEvent) => {
      const usable = rect.height - SPLITTER_HEIGHT
      if (usable <= 0) return
      const next = clampSplitRatio((pointerEvent.clientY - rect.top) / usable)
      splitRef.current = next
      setSplitRatio(next)
    }
    const stop = () => {
      window.removeEventListener("pointermove", move)
      writeSplitRatio(splitRef.current)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop, { once: true })
  }

  /** 键盘可达：↑↓ 各 5%，Home 复位 */
  function handleSplitKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = { ArrowUp: -0.05, ArrowDown: 0.05 }
    if (event.key in steps) {
      const next = clampSplitRatio(splitRef.current + steps[event.key])
      splitRef.current = next
      setSplitRatio(next)
      writeSplitRatio(next)
      event.preventDefault()
    } else if (event.key === "Home") {
      splitRef.current = DEFAULT_SPLIT_RATIO
      setSplitRatio(DEFAULT_SPLIT_RATIO)
      writeSplitRatio(DEFAULT_SPLIT_RATIO)
      event.preventDefault()
    }
  }

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

  return (
    <aside
      aria-label="R 分析工作台"
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-y-0 right-0 z-[60] flex w-full max-w-[620px] flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-2xl transition-transform duration-200 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <RWorkbenchHeader rowCount={dataset.rows.length} colCount={dataset.columns.length} onClose={onClose} />

      <RWorkbenchToolbar
        busy={webR.busy}
        onRun={handleRun}
        onInterrupt={() => void interrupt()}
        onClear={clearOutput}
        onCopy={handleCopy}
        canInterrupt={true}
      />

      {/* 内容区：代码与输出按可拖拽比例分配高度，各自内部滚动（消除「挤压成细长条」） */}
      <div ref={contentRef} className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
        <section
          aria-label="R 代码"
          style={{ flexGrow: splitRatio, flexBasis: 0 }}
          className="flex min-h-[180px] flex-col overflow-hidden rounded-md border border-[var(--border)]"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--muted)] px-2 py-1">
            <span className="text-[10px] font-medium text-[var(--muted-foreground)]">代码（df 已注入当前结果集）</span>
            <span className="hidden text-[10px] text-[var(--muted-foreground)] sm:inline">Ctrl+Enter 运行</span>
          </div>
          <div className="min-h-0 flex-1">
            <RWorkbenchEditor value={code} onChange={setCode} onRun={handleRun} />
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="调整代码与输出高度（双击或 Home 复位）"
          tabIndex={0}
          onPointerDown={startSplit}
          onDoubleClick={() => {
            splitRef.current = DEFAULT_SPLIT_RATIO
            setSplitRatio(DEFAULT_SPLIT_RATIO)
            writeSplitRatio(DEFAULT_SPLIT_RATIO)
          }}
          onKeyDown={handleSplitKey}
          className="group flex h-5 shrink-0 cursor-row-resize items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <span className="h-0.5 w-10 rounded bg-[var(--border)] transition-colors group-hover:bg-[var(--ring)]" />
        </div>

        <section
          aria-label="R 输出"
          style={{ flexGrow: 1 - splitRatio, flexBasis: 0 }}
          className="flex min-h-[120px] flex-col overflow-hidden rounded-md border border-[var(--border)]"
        >
          <div className="shrink-0 border-b border-[var(--border)] bg-[var(--muted)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)]">
            输出
          </div>
          <div className="min-h-0 flex-1">
            <RWorkbenchOutput items={webR.output} images={webR.images} busy={webR.busy} />
          </div>
        </section>
      </div>

      <RWorkbenchStatusBar
        packages={webR.packages}
        lastExecMs={webR.lastExecMs}
        busy={webR.busy}
        status={webR.status}
        error={webR.error}
        pendingInjection={injectedFor === null && webR.status === "ready"}
      />
    </aside>
  )
}
