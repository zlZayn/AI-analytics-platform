import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ChartErrorBoundary } from "../error-boundary"

function Broken({ fail }: { fail: boolean }) {
  if (fail) throw new Error("sensitive details")
  return <div>chart recovered</div>
}

describe("ChartErrorBoundary", () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it("resets when data or mapping changes and hides internal error details", async () => {
    const container = document.createElement("div")
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(<ChartErrorBoundary chartType="测试" resetKeys={["bad"]}><Broken fail /></ChartErrorBoundary>))
    expect(container.textContent).toContain("测试图表渲染失败")
    expect(container.textContent).not.toContain("sensitive details")

    await act(async () => root.render(<ChartErrorBoundary chartType="测试" resetKeys={["good"]}><Broken fail={false} /></ChartErrorBoundary>))
    expect(container.textContent).toContain("chart recovered")
    await act(async () => root.unmount())
  })
})
