import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SemanticDataset } from "@/types/session"
import type { RHistoryEntry } from "@/types/history"
import type { ROutputItem } from "@/lib/webr-client"

// WebR 单例与历史读写都经 hook/模块注入：本测试只断言「面板调了哪些动作、传了什么代码」
const webr = vi.hoisted(() => ({
  state: {
    status: "ready" as const,
    packages: ["dplyr", "ggplot2"],
    busy: false,
    injecting: false,
    output: [] as ROutputItem[],
    images: [] as ImageBitmap[],
    lastExecMs: null as number | null,
    lastImageCount: 0,
  },
  init: vi.fn(async () => {}),
  ensurePackages: vi.fn(async () => {}),
  injectData: vi.fn(async () => {}),
  execute: vi.fn<(code: string) => Promise<void>>(async () => {}),
  interrupt: vi.fn(async () => {}),
  clearOutput: vi.fn(),
  restoreOutput: vi.fn(),
  reportError: vi.fn(),
}))

const history = vi.hoisted(() => ({
  listRHistory: vi.fn<() => Promise<RHistoryEntry[]>>(async () => []),
  appendHistory: vi.fn(),
}))

vi.mock("@/hooks/useWebR", () => ({
  useWebR: () => ({
    ...webr.state,
    destroy: () => {},
    runStats: async () => "",
    init: webr.init,
    ensurePackages: webr.ensurePackages,
    injectData: webr.injectData,
    execute: webr.execute,
    interrupt: webr.interrupt,
    clearOutput: webr.clearOutput,
    restoreOutput: webr.restoreOutput,
    reportError: webr.reportError,
  }),
}))

vi.mock("@/lib/history-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/history-client")>()),
  listRHistory: history.listRHistory,
  appendHistory: history.appendHistory,
}))

// Monaco 与回放契约无关，替换成占位
vi.mock("../r-workbench-editor", () => ({ RWorkbenchEditor: () => <div data-testid="r-editor" /> }))

import { RWorkbench } from "../r-workbench"

const dataset: SemanticDataset = {
  columns: [
    { name: "sales", type: "float8", semanticType: "numeric" },
    { name: "region", type: "varchar", semanticType: "categorical" },
  ],
  rows: [{ sales: 1, region: "A" }],
  rowCount: 1,
  returnedRowCount: 1,
  truncated: false,
  rowLimit: 5000,
  executionTimeMs: 3,
}

function rEntry(id: string, code: string, extra: Partial<RHistoryEntry> = {}): RHistoryEntry {
  return {
    id,
    connectionId: "c1",
    sessionId: "s1",
    createdAt: "2026-09-11T09:00:00.000Z",
    kind: "r",
    code,
    output: [],
    ok: true,
    ...extra,
  }
}

async function render(props: Partial<React.ComponentProps<typeof RWorkbench>> = {}) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <RWorkbench
        dataset={dataset}
        open
        onClose={() => {}}
        connectionId="c1"
        sessionId="s1"
        sourceSql="SELECT sales, region FROM orders"
        {...props}
      />,
    )
  })
  return { container, root }
}

/** bootstrap 是「取历史 → 初始化 → 装包 → 注入」串行链，多轮宏任务后动作才全部落地 */
async function settle(times = 4) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

// jsdom 未实现 scrollIntoView（输出区自动滚底会调用）
Element.prototype.scrollIntoView = () => {}

describe("RWorkbench 历史回放", () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  beforeEach(() => {
    vi.clearAllMocks()
    webr.state.output = []
    webr.state.lastExecMs = null
    webr.state.lastImageCount = 0
    history.listRHistory.mockResolvedValue([])
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it("回放指定条目：清空旧输出后自动重跑该条代码，而不是最近一条", async () => {
    const replayCode = [
      "df <- data.frame(",
      "  x = c(1, 2)",
      ")",
      "",
      "library(ggplot2)",
      "ggplot(df, aes(x = x)) +",
      "  geom_histogram(bins = 5)",
    ].join("\n")
    history.listRHistory.mockResolvedValueOnce([rEntry("r-latest", "summary(df)"), rEntry("r-old", replayCode, { sourceSql: "SELECT 1" })])

    const { root } = await render({ replayId: "r-old" })
    await settle()

    expect(webr.clearOutput).toHaveBeenCalledTimes(1)
    expect(webr.execute).toHaveBeenCalledTimes(1)
    const code = webr.execute.mock.calls[0][0]
    expect(code).toContain("geom_histogram")
    // 不是最近一条，也不是按当前数据集重生成的模板
    expect(code).not.toContain("summary(df)")
    expect(code).not.toContain("geom_boxplot")
    // df 必须来自当前结果集（旧数据块被剥离后重建）
    expect(code.startsWith("df <- data.frame(")).toBe(true)
    expect(code).toContain('region = c("A")')
    // 先清后跑：旧文本/旧图不会与回放结果混在一起
    expect(webr.clearOutput.mock.invocationCallOrder[0]).toBeLessThan(webr.execute.mock.invocationCallOrder[0])
    expect(webr.restoreOutput).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it("普通打开：不自动执行，恢复最近一条代码与其文本输出", async () => {
    history.listRHistory.mockResolvedValueOnce([rEntry("r-1", "df <- data.frame(x = 1)\nsummary(df)", { output: ["[stdout] 上次输出"] })])

    const { root } = await render()
    await settle()

    expect(webr.execute).not.toHaveBeenCalled()
    expect(webr.clearOutput).not.toHaveBeenCalled()
    expect(webr.restoreOutput).toHaveBeenCalledWith(["[stdout] 上次输出"])

    await act(async () => root.unmount())
  })

  it("回放 id 在服务端不存在：明确提示，不静默执行别的东西", async () => {
    history.listRHistory.mockResolvedValueOnce([rEntry("r-1", "summary(df)", { output: ["[stdout] 最近一次"] })])

    const { root } = await render({ replayId: "r-missing" })
    await settle()

    expect(webr.execute).not.toHaveBeenCalled()
    expect(webr.reportError).toHaveBeenCalledWith(expect.stringContaining("未找到这条 R 历史"))

    await act(async () => root.unmount())
  })

  it("回放但运行时不可用：退回该条历史的文本输出，不执行也不清空", async () => {
    history.listRHistory.mockResolvedValueOnce([rEntry("r-1", "plot(df)", { output: ["[error] boom"] })])
    webr.init.mockRejectedValueOnce(new Error("offline"))

    const { root } = await render({ replayId: "r-1" })
    await settle()

    expect(webr.execute).not.toHaveBeenCalled()
    expect(webr.clearOutput).not.toHaveBeenCalled()
    expect(webr.restoreOutput).toHaveBeenCalledWith(["[error] boom"])
    expect(webr.reportError).toHaveBeenCalled()

    await act(async () => root.unmount())
  })

  it("落历史：只有图没有文本的执行也记录图片张数", async () => {
    webr.state.lastExecMs = 1200
    webr.state.lastImageCount = 2

    const { root } = await render()
    await settle()

    expect(history.appendHistory).toHaveBeenCalledWith(expect.objectContaining({ kind: "r", output: [], imageCount: 2 }))

    await act(async () => root.unmount())
  })

  it("落历史：既无文本也无图的执行不产生噪声条目", async () => {
    webr.state.lastExecMs = 1200

    const { root } = await render()
    await settle()

    expect(history.appendHistory).not.toHaveBeenCalled()

    await act(async () => root.unmount())
  })
})
