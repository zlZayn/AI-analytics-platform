import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InsightItem } from "@/lib/ai-contract"
import { InsightCard } from "./insight-card"

const baseItem: InsightItem = {
  title: "销售趋势",
  insight: "销售额按月上升",
  sql: "SELECT date_trunc('month', day) AS month, SUM(sales) AS total FROM orders GROUP BY 1 ORDER BY 1",
  chart: { chartType: "line", x: "month", y: "total" },
  fallback: true,
}

async function renderCard(
  props: Partial<React.ComponentProps<typeof InsightCard>> = {}
) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const onExecute = vi.fn()
  await act(async () => {
    root.render(
      <InsightCard
        index={0}
        item={baseItem}
        onExecute={onExecute}
        {...props}
      />
    )
  })
  return { container, root, onExecute }
}

describe("InsightCard", () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  afterEach(() => {
    document.body.replaceChildren()
  })

  it("renders title and insight", async () => {
    const { container, root } = await renderCard()
    expect(container.textContent).toContain("销售趋势")
    expect(container.textContent).toContain("销售额按月上升")
    await act(async () => root.unmount())
  })

  it("calls onExecute with sql and chart on click", async () => {
    const { container, root, onExecute } = await renderCard()
    const executeButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent?.includes("执行")
    )
    expect(executeButton).toBeDefined()
    await act(async () => executeButton!.click())
    expect(onExecute).toHaveBeenCalledWith(baseItem.sql, baseItem.chart)
    await act(async () => root.unmount())
  })

  it("disables execute while loading", async () => {
    const { container, root, onExecute } = await renderCard({ loading: true })
    const executeButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent?.includes("执行")
    )
    expect(executeButton?.disabled).toBe(true)
    await act(async () => executeButton!.click())
    expect(onExecute).not.toHaveBeenCalled()
    await act(async () => root.unmount())
  })

  it("shows card-level error", async () => {
    const { container, root } = await renderCard({ error: "查询超时" })
    expect(container.textContent).toContain("查询超时")
    await act(async () => root.unmount())
  })

  it("expands and collapses SQL details", async () => {
    const { container, root } = await renderCard()
    expect(container.textContent).not.toContain("图表:")
    const expandButton = container.querySelector("button[title='查看 SQL']") as HTMLButtonElement
    await act(async () => expandButton.click())
    expect(container.textContent).toContain("SELECT date_trunc")
    expect(container.textContent).toContain("图表: line")
    await act(async () => expandButton.click())
    expect(container.textContent).not.toContain("SELECT date_trunc")
    await act(async () => root.unmount())
  })
})