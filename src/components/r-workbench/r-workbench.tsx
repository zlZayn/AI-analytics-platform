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

import { useCallback, useEffect, useRef, useState } from "react"
import type * as React from "react"
import { RWorkbenchHeader } from "./r-workbench-header"
import { RWorkbenchToolbar } from "./r-workbench-toolbar"
import { RWorkbenchEditor } from "./r-workbench-editor"
import { RWorkbenchOutput } from "./r-workbench-output"
import { RWorkbenchStatusBar } from "./r-workbench-status-bar"
import { useWebR } from "@/hooks/useWebR"
import { useSplitRatio } from "@/hooks/useSplitRatio"
import { SplitHandle } from "@/components/ui/split-handle"
import { SPLIT_PRESETS } from "@/lib/split"
import { buildDataFrameCode, generateRTemplate, stripDataFrameAssignment } from "@/lib/r-bridge"
import { appendHistory, listRHistory, toPersistedOutput } from "@/lib/history-client"
import { withTimeout } from "@/lib/webr-client"
import type { SemanticDataset } from "@/types/session"

interface RWorkbenchProps {
  dataset: SemanticDataset
  open: boolean
  onClose: () => void
  /** 历史记录作用域（连接 id）：与后端 SQL 历史同轴，统一历史按此键存取 */
  connectionId: string
  /** 产生历史的会话 id（溯源字段，不参与作用域键） */
  sessionId: string
  /** 当前结果集来源的 SQL：随 R 执行历史落库，历史面板据此带回工作台重跑 df */
  sourceSql: string
  /** 历史回放条目 id（来自 URL `?r=`）：打开面板时载入并**重新执行**该条代码（而非最近一条） */
  replayId?: string
}

// 代码/输出分割：统一句柄 + 统一预设（src/lib/split.ts 的 SPLIT_PRESETS.rWorkbench）

export function RWorkbench({ dataset, open, onClose, connectionId, sessionId, sourceSql, replayId }: RWorkbenchProps) {
  const webR = useWebR()
  const [code, setCode] = useState("")
  const [injectedFor, setInjectedFor] = useState<SemanticDataset | null>(null)
  const panelSplit = useSplitRatio(
    SPLIT_PRESETS.rWorkbench.key,
    SPLIT_PRESETS.rWorkbench.defaultRatio,
    SPLIT_PRESETS.rWorkbench.bounds,
  )
  const contentRef = useRef<HTMLDivElement | null>(null)
  const initializedRef = useRef(false)
  const codeRef = useRef("")
  const loggedExecRef = useRef<number | null>(null)
  const restoredOutputRef = useRef(false)
  /** 已自动重跑的条目 id：回放 = 重新执行，同一条只重跑一次 */
  const replayRunRef = useRef<string | null>(null)
  const sourceSqlRef = useRef(sourceSql)
  const viewportRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    sourceSqlRef.current = sourceSql
  }, [sourceSql])

  // 宽度以像素语义为准（420..1200px），换算成视口比例交给统一句柄
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth
  const widthBounds = { min: 420 / viewportWidth, max: Math.min(1200, viewportWidth) / viewportWidth }
  const widthSplit = useSplitRatio(
    SPLIT_PRESETS.rWorkbenchWidth.key,
    Math.min(620, viewportWidth) / viewportWidth,
    widthBounds,
  )

  useEffect(() => {
    viewportRef.current = document.documentElement
  }, [])

  useEffect(() => {
    codeRef.current = code
  }, [code])

  // actions 为稳定引用（useWebR useMemo）；effect 依赖它们不会因渲染变化重触发
  const { init, ensurePackages, injectData, clearOutput, interrupt, execute, reportError, restoreOutput } = webR

  /** 统一执行入口（手动运行与历史回放共用）：超时输出 error 后尝试中断 */
  const runCode = useCallback(
    async (source: string) => {
      try {
        await withTimeout(execute(source), 60_000)
      } catch {
        await interrupt()
      }
    },
    [execute, interrupt],
  )

  // 打开时：初始化 WebR + 注入数据 + 填充模板
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function bootstrap() {
      // 代码来源：用户改过 → 保留；否则优先回放指定条目（URL `?r=`）、其次恢复最近一条历史
      //（去掉旧数据块，df 必须来自当前注入），无历史时用按当前数据集生成的模板。
      // 历史取自服务端（api/history），取不到就退化成模板——运行时不初始化也能读、改、复制。
      const template = generateRTemplate(dataset)
      const rHistory = connectionId ? await listRHistory(connectionId) : []
      if (cancelled) return
      const replay = replayId ? rHistory.find((entry) => entry.id === replayId) ?? null : null
      // URL 带了回放 id、库里却没有这条记录（被清理/换连接）：明确提示，不退化成最近一条而不吭声
      const replayMissing = Boolean(replayId) && Boolean(connectionId) && !replay
      const history = replay ?? rHistory[0] ?? null
      const current = codeRef.current
      let nextCode = template
      if (current.trim().length > 0 && current !== template) {
        nextCode = current
      } else if (history?.code.trim()) {
        const analysisOnly = stripDataFrameAssignment(history.code)
        if (analysisOnly.trim()) nextCode = `${buildDataFrameCode(dataset)}\n\n${analysisOnly}`
      }
      codeRef.current = nextCode
      setCode(nextCode)

      try {
        await init()
        if (cancelled) return
        await ensurePackages(["dplyr", "ggplot2"])
        if (cancelled) return
        await injectData(dataset)
        if (cancelled) return
        setInjectedFor(dataset)
        // 回放 = 重新执行：图片（ImageBitmap）不可序列化，只能靠重跑重绘；
        // 先清掉上一次的输出与图片，避免旧文本/旧图被当成这条历史的结果（历史面板的「执行」即此语义）
        if (replay) {
          if (replayRunRef.current === replay.id) return
          replayRunRef.current = replay.id
          clearOutput()
          await runCode(nextCode)
          return
        }
        // 普通打开：回放上次的文本输出（图片不持久化）：本组件生命周期内只回放一次，避免覆盖本次会话的输出
        if (!restoredOutputRef.current && history?.output.length) {
          restoredOutputRef.current = true
          restoreOutput(history.output)
        }
        if (replayMissing) {
          reportError("未找到这条 R 历史（可能已被清理或不在当前浏览器），已改为恢复最近一条")
        }
      } catch {
        // init/inject 失败：错误写入输出区（离开「等待运行…」占位），
        // 具体原因经 webR.error 显示在状态栏（此处不读 state，避免 effect 依赖循环）。
        // StrictMode 双跑时两轮 await 同一份失败的 initPromise，本轮已被 cleanup 取消则不再重复报错
        if (cancelled) return
        reportError("R 环境初始化失败，请检查网络后刷新页面重试")
        // 运行时起不来：至少把这条历史当时的文本输出显示出来，回放不至于空白
        if (replay && !restoredOutputRef.current && replay.output.length) {
          restoredOutputRef.current = true
          restoreOutput(replay.output)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [open, dataset, init, ensurePackages, injectData, reportError, restoreOutput, clearOutput, runCode, connectionId, replayId])

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

  // 每次执行完成（lastExecMs 变化）落一条 R 历史：文本输出可回放，图片不持久化（回放靠重跑重绘）
  useEffect(() => {
    if (webR.lastExecMs === null || loggedExecRef.current === webR.lastExecMs || !connectionId) return
    loggedExecRef.current = webR.lastExecMs
    const textItems = webR.output.filter((item) => typeof item.data === "string")
    // 只出图、没有文本的执行同样落库，否则纯绘图代码在历史里彻底消失
    if (textItems.length === 0 && webR.lastImageCount === 0) return
    appendHistory({
      kind: "r",
      connectionId,
      sessionId,
      code: codeRef.current,
      sourceSql: sourceSqlRef.current || undefined,
      output: toPersistedOutput(textItems),
      imageCount: webR.lastImageCount,
      ok: !textItems.some((item) => item.type === "error"),
    })
  }, [webR.lastExecMs, webR.output, webR.lastImageCount, connectionId, sessionId])

  function handleRun() {
    void runCode(code)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
  }

  return (
    <aside
      aria-label="R 分析工作台"
      aria-hidden={!open}
      inert={!open}
      style={{ width: Math.round(widthSplit.ratio * viewportWidth) }}
      className={`fixed inset-y-0 right-0 z-[60] flex max-w-full flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-2xl transition-transform duration-200 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <SplitHandle
        axis="x"
        invert
        ratio={widthSplit.ratio}
        bounds={widthBounds}
        onPreview={widthSplit.preview}
        onCommit={widthSplit.commit}
        onReset={widthSplit.reset}
        containerRef={viewportRef}
        thickness={8}
        label="调整 R 面板宽度（双击或 Home 复位）"
        className="absolute inset-y-0 left-0 z-10 -ml-1 hidden lg:flex"
      />
      <RWorkbenchHeader rowCount={dataset.rows.length} colCount={dataset.columns.length} onClose={onClose} />

      <RWorkbenchToolbar
        busy={webR.busy || webR.injecting}
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
          style={{ flexGrow: panelSplit.ratio, flexBasis: 0 }}
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

        <SplitHandle
          axis="y"
          ratio={panelSplit.ratio}
          bounds={SPLIT_PRESETS.rWorkbench.bounds}
          onPreview={panelSplit.preview}
          onCommit={panelSplit.commit}
          onReset={panelSplit.reset}
          containerRef={contentRef}
          label="调整代码与输出高度（双击或 Home 复位）"
        />

        <section
          aria-label="R 输出"
          style={{ flexGrow: 1 - panelSplit.ratio, flexBasis: 0 }}
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
        injecting={webR.injecting || (injectedFor === null && webR.status === "ready")}
      />
    </aside>
  )
}
