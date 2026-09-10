import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { SessionDispatch } from "@/types/actions"
import type { AnalysisSession, DisplayConfig, QuerySpec, SemanticDataset } from "@/types/session"
import { useSession } from "../useSession"

function dataset(): SemanticDataset {
  return {
    columns: [{ name: "total", type: "int4", semanticType: "numeric" }],
    rows: [{ total: 1 }],
    rowCount: 1,
    returnedRowCount: 1,
    truncated: false,
    rowLimit: 5000,
    executionTimeMs: 1,
  }
}

const QUERY_SPEC: QuerySpec = { table: "orders", measures: [{ field: "amount", aggregation: "sum", alias: "total" }] }
const DISPLAY_CONFIG: DisplayConfig = { chartType: "table", mapping: { chartType: "table" } }

function renderSession() {
  const executeCompiled = vi.fn(async () => dataset())
  const captured: { session: AnalysisSession | null; dispatch: SessionDispatch | null } = { session: null, dispatch: null }
  function Probe() {
    const { session, dispatch } = useSession({ connectionId: "conn-1", schema: null, executeCompiled })
    captured.session = session
    captured.dispatch = dispatch
    return null
  }
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<Probe />)
  })
  return { captured, root, executeCompiled }
}

async function runInsight(captured: { dispatch: SessionDispatch | null }, question: string) {
  await act(async () => {
    captured.dispatch?.({
      type: "INIT_FROM_AI",
      payload: { question, title: "各区域销售额", insight: "华东最高", querySpec: QUERY_SPEC, displayConfig: DISPLAY_CONFIG },
    })
  })
  // 冲刷编译 effect → 执行 promise → EXECUTE_SUCCESS
  await act(async () => {
    await Promise.resolve()
  })
}

describe("useSession 执行契约", () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  afterEach(() => {
    document.body.replaceChildren()
  })

  it("首次执行：编译并执行一次，状态回到 ready", async () => {
    const { captured, root, executeCompiled } = renderSession()

    await runInsight(captured, "按区域统计")

    expect(executeCompiled).toHaveBeenCalledTimes(1)
    expect(captured.session?.status).toBe("ready")
    expect(captured.session?.runId).toBe(1)

    act(() => root.unmount())
  })

  it("同一份 querySpec 的再次执行请求必须真的再执行（不得停在 compiling）", async () => {
    const { captured, root, executeCompiled } = renderSession()

    await runInsight(captured, "按区域统计")
    await runInsight(captured, "按区域统计")

    expect(executeCompiled).toHaveBeenCalledTimes(2)
    expect(captured.session?.status).toBe("ready")
    expect(captured.session?.runId).toBe(2)

    act(() => root.unmount())
  })
})
