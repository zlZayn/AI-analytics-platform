import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AnalysisSession } from "@/types/session"

// R 工作台依赖 WebR 单例，本测试只关心结果区布局与数据来源
vi.mock("@/components/r-workbench", () => ({ RWorkbench: () => null }))

// 图表桩只暴露「收到哪个映射、几行数据」，避免 recharts 在 jsdom 下渲染
vi.mock("@/components/chart", () => ({
  Chart: ({ mapping, data }: { mapping: { chartType: string }; data: Record<string, unknown>[] }) => (
    <div data-testid="stub-chart">{mapping.chartType + ":" + data.length}</div>
  ),
}))

import { SessionView } from "../SessionView"

/** sales 第二行为空串：图表绑定会过滤，明细必须保留 */
const result = {
  columns: [
    { name: "region", type: "text", semanticType: "categorical" as const },
    { name: "sales", type: "numeric", semanticType: "numeric" as const },
  ],
  rows: [
    { region: "华东", sales: 10 },
    { region: "华南", sales: "" },
  ],
  rowCount: 2,
  returnedRowCount: 2,
  truncated: false,
  rowLimit: 5000,
  executionTimeMs: 3,
}

function buildSession(displayConfig: AnalysisSession["displayConfig"]): AnalysisSession {
  return {
    id: "session-1",
    question: "销售分布",
    title: "销售分布",
    insight: "",
    querySpec: { table: "orders" },
    compiledSql: { sql: "SELECT region, sales FROM orders", params: [] },
    result,
    displayConfig,
    status: "ready",
    source: "user",
    isUserModified: false,
    conversationHistory: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

const barConfig: AnalysisSession["displayConfig"] = {
  chartType: "bar",
  mapping: { chartType: "bar", x: "region", y: "sales" },
}

const tableConfig: AnalysisSession["displayConfig"] = { chartType: "table", mapping: { chartType: "table" } }

async function render(session: AnalysisSession, tab: string) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <SessionView session={session} onMappingChange={() => undefined} onCopySql={() => undefined} tab={tab} />,
    )
  })
  return { container, root }
}

function chartPayloads(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-testid='stub-chart']")).map((element) => element.textContent ?? "")
}

describe("SessionView 结果区", () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  afterEach(() => {
    document.body.replaceChildren()
  })

  it("明细渲染原始查询行，不随图表绑定的行过滤变化", async () => {
    const { container, root } = await render(buildSession(barConfig), "data")

    expect(chartPayloads(container)).toContain("table:2")
    expect(chartPayloads(container)).toContain("bar:1")

    await act(async () => root.unmount())
  })

  it("探索在表格态显示图表引导，不渲染图表", async () => {
    const { container, root } = await render(buildSession(tableConfig), "explore")

    expect(container.querySelector("[data-testid='chart-guide']")).not.toBeNull()
    expect(container.querySelector("[data-testid='chart-surface']")).toBeNull()
    expect(chartPayloads(container)).toEqual(["table:2"])

    await act(async () => root.unmount())
  })

  it("探索在选定图表类型后渲染图表", async () => {
    const { container, root } = await render(buildSession(barConfig), "explore")

    expect(container.querySelector("[data-testid='chart-surface']")).not.toBeNull()
    expect(chartPayloads(container)).toContain("bar:1")

    await act(async () => root.unmount())
  })
})
