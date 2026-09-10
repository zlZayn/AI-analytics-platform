import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InsightItem } from "@/lib/ai-contract"
import type { AnalysisSession } from "@/types/session"
import type { SessionAction } from "@/types/actions"

const mocks = vi.hoisted(() => ({ fetchApi: vi.fn() }))

vi.mock("@/lib/client-api", () => ({
  fetchApi: mocks.fetchApi,
  ApiRequestError: class ApiRequestError extends Error {
    code: string
    retryable: boolean
    constructor(message: string, code: string, retryable = true) {
      super(message)
      this.code = code
      this.retryable = retryable
    }
  },
}))

import { useAiAssistant, type AiAssistant } from "../useAiAssistant"

function session(): AnalysisSession {
  return {
    id: "session-1",
    question: "",
    title: "",
    insight: "",
    querySpec: { table: "" },
    compiledSql: null,
    result: null,
    displayConfig: { chartType: "table", mapping: { chartType: "table" } },
    status: "idle",
    source: "user",
    isUserModified: false,
    runId: 0,
    conversationHistory: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

function insight(overrides: Partial<InsightItem> = {}): InsightItem {
  return {
    title: "各区域销售额",
    insight: "华东最高",
    chart: { chartType: "bar", x: "region", y: "total" },
    querySpec: { table: "orders" },
    displayConfig: { chartType: "bar", mapping: { chartType: "bar", x: "region", y: "total" } },
    fallback: false,
    ...overrides,
  }
}

interface Capture {
  assistant: AiAssistant | null
  actions: SessionAction[]
  drafts: string[]
  tabs: string[]
  notices: string[]
}

function renderAssistant(currentSession: AnalysisSession) {
  const captured: Capture = { assistant: null, actions: [], drafts: [], tabs: [], notices: [] }
  function Probe() {
    captured.assistant = useAiAssistant({
      connectionId: "conn-1",
      session: currentSession,
      dispatch: (action) => captured.actions.push(action),
      onSqlDraft: (sql) => captured.drafts.push(sql),
      onTabChange: (tab) => captured.tabs.push(tab),
      notify: (message, tone) => captured.notices.push(tone + ":" + message),
    })
    return null
  }
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<Probe />)
  })
  return { captured, root }
}

async function ask(captured: Capture, text: string) {
  act(() => captured.assistant?.setInput(text))
  await act(async () => {
    await captured.assistant?.ask()
  })
}

describe("useAiAssistant", () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  afterEach(() => {
    document.body.replaceChildren()
    mocks.fetchApi.mockReset()
  })

  it("提问成功：记录提问 → INIT_FROM_AI → 对话与通知，并切洞察 Tab", async () => {
    mocks.fetchApi.mockResolvedValue({ success: true, data: { items: [insight(), insight({ title: "趋势" })] }, requestId: "t" })
    const { captured, root } = renderAssistant(session())

    await ask(captured, "按区域统计 @orders")

    expect(captured.actions[0]).toEqual({ type: "ASK_AI", question: "按区域统计 @orders" })
    const init = captured.actions.find((action) => action.type === "INIT_FROM_AI")
    expect(init).toMatchObject({ payload: { question: "按区域统计 @orders", title: "各区域销售额" } })
    expect(captured.actions.some((action) => action.type === "ADD_CONVERSATION")).toBe(true)
    expect(captured.tabs).toEqual(["insights"])
    expect(captured.notices).toEqual(["success:已生成 2 条分析，执行第 1 条"])
    expect(captured.assistant?.insights).toHaveLength(2)
    expect(captured.assistant?.input).toBe("")

    const [url, init2] = mocks.fetchApi.mock.calls[0] as [string, { body: string }]
    expect(url).toBe("/api/ai")
    const body = JSON.parse(init2.body)
    expect(body).toMatchObject({ connectionId: "conn-1", conversationId: "session-1", referencedTables: ["orders"] })

    act(() => root.unmount())
  })

  it("回退项（只有 sql）走 SET_COMPILED_SQL 并回填编辑器草稿", async () => {
    mocks.fetchApi.mockResolvedValue({
      success: true,
      data: { items: [insight({ querySpec: undefined, displayConfig: undefined, fallback: true, sql: "SELECT 1 AS total" })] },
      requestId: "t",
    })
    const { captured, root } = renderAssistant(session())

    await ask(captured, "统计")

    expect(captured.actions).toContainEqual({ type: "SET_COMPILED_SQL", compiledSql: { sql: "SELECT 1 AS total", params: [] } })
    expect(captured.drafts).toEqual(["SELECT 1 AS total"])

    act(() => root.unmount())
  })

  it("空结果：只记对话与警告，不进会话状态", async () => {
    mocks.fetchApi.mockResolvedValue({ success: true, data: { items: [] }, requestId: "t" })
    const { captured, root } = renderAssistant(session())

    await ask(captured, "统计")

    expect(captured.actions.some((action) => action.type === "INIT_FROM_AI")).toBe(false)
    expect(captured.actions.some((action) => action.type === "ADD_CONVERSATION")).toBe(true)
    expect(captured.notices).toEqual(["warning:AI 未生成有效结果"])

    act(() => root.unmount())
  })

  it("未配置：标记 unavailable 并给出 .env 指引；卡片执行沿用同一映射", async () => {
    mocks.fetchApi.mockRejectedValue(Object.assign(new Error("AI 服务未配置：缺少 API Key"), { code: "AI_NOT_CONFIGURED" }))
    const { captured, root } = renderAssistant(session())

    await ask(captured, "统计")
    expect(captured.assistant?.unavailable).toBe(true)
    expect(captured.notices).toEqual(["warning:AI 服务未配置，请在 .env 文件中设置 AI_API_KEY"])

    act(() => captured.assistant?.execute(3))
    expect(captured.assistant?.executingIndex).toBeNull()

    act(() => root.unmount())
  })
})
