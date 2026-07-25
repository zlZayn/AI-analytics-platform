import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { QueryResult } from "@/types"
import { ResultPanel } from "./result-panel"

vi.mock("@/components/chart-config-panel", () => ({
  ChartConfigPanel: ({ mapping, onChange }: {
    mapping: { chartType: string }
    onChange: (mapping: { chartType: string }) => void
  }) => (
    <button data-testid="chart-type" type="button" onClick={() => onChange({ chartType: "bar" })}>
      {mapping.chartType}
    </button>
  ),
}))

const result: QueryResult = {
  columns: [
    { name: "category", type: "text" },
    { name: "value", type: "int4" },
  ],
  rows: [{ category: "A", value: 1 }],
  rowCount: 1,
  returnedRowCount: 1,
  truncated: false,
  rowLimit: 5000,
  executionTimeMs: 1,
}

describe("ResultPanel", () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  afterEach(() => {
    document.body.replaceChildren()
  })

  it("keeps a user-selected chart type after the panel rerenders", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<ResultPanel result={result} onCopySql={() => undefined} />)
    })

    const chartTypeButton = container.querySelector<HTMLButtonElement>("[data-testid='chart-type']")
    expect(chartTypeButton?.textContent).toBe("table")

    await act(async () => {
      chartTypeButton?.click()
    })

    expect(container.querySelector("[data-testid='chart-type']")?.textContent).toBe("bar")

    await act(async () => root.unmount())
  })
})
