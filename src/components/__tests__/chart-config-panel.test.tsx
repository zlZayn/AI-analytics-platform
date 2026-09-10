import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ChartMapping } from "@/components/chart"
import { ChartConfigPanel } from "../chart-config-panel"

const columns = [
  { name: "day", type: "date" },
  { name: "region", type: "text" },
  { name: "sales", type: "int4" },
]

const data = [
  { day: "2026-01-01", region: "华东", sales: 10 },
  { day: "2026-01-02", region: "华南", sales: 14 },
]

const tableMapping: ChartMapping = { chartType: "table" }

async function render(mapping: ChartMapping, onChange: (mapping: ChartMapping) => void) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<ChartConfigPanel columns={columns} data={data} mapping={mapping} onChange={onChange} />)
  })
  return { container, root }
}

describe("ChartConfigPanel", () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  afterEach(() => {
    document.body.replaceChildren()
  })

  it("表格态显示图表引导，不渲染第二份数据表", async () => {
    const { container, root } = await render(tableMapping, () => undefined)

    expect(container.querySelector("[data-testid='chart-guide']")).not.toBeNull()
    expect(container.querySelector("[data-testid='chart-surface']")).toBeNull()
    expect(container.querySelectorAll("table")).toHaveLength(0)

    await act(async () => root.unmount())
  })

  it("类型选择器不含「表格」，选择图表类型回传映射", async () => {
    const onChange = vi.fn()
    const { container, root } = await render(tableMapping, onChange)

    const buttons = Array.from(container.querySelectorAll("button"))
    expect(buttons.map((button) => button.textContent)).not.toContain("表格")

    const bar = buttons.find((button) => button.textContent === "柱状图")
    await act(async () => bar?.click())
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ chartType: "bar" }))

    await act(async () => root.unmount())
  })

  it("可用列默认折叠，纵向空间留给图表", async () => {
    const { container, root } = await render(tableMapping, () => undefined)

    const details = container.querySelector("details")
    expect(details).not.toBeNull()
    expect(details?.open).toBe(false)

    await act(async () => root.unmount())
  })
})
