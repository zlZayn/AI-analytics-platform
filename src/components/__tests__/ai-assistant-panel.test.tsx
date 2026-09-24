import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AiAssistant } from "@/hooks/useAiAssistant"
import type { ConversationMessage } from "@/types/session"
import { AiAssistantPanel } from "../workspace/ai-assistant-panel"

/** 面板只依赖可见范围提示的呈现，不在此测它自身（mock 掉连带依赖） */
vi.mock("@/components/ai-visibility-hint", () => ({
  AiVisibilityHint: () => <div data-testid="visibility-hint" />,
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function assistant(overrides: Partial<AiAssistant> = {}): AiAssistant {
  return {
    input: "",
    setInput: () => {},
    asking: false,
    unavailable: false,
    insights: [],
    executingIndex: null,
    activeInsightIndex: null,
    ask: async () => {},
    execute: () => {},
    clearInsights: () => {},
    ...overrides,
  }
}

function message(role: ConversationMessage["role"], content: string): ConversationMessage {
  return { role, content, createdAt: new Date("2026-09-24T00:00:00Z") }
}

function renderPanel(props: Partial<{
  assistant: AiAssistant
  conversationHistory: ConversationMessage[]
  schema: Parameters<typeof AiAssistantPanel>[0]["schema"]
  busy: boolean
  onReset: () => void
}> = {}) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  const onReset = vi.fn()
  const full = {
    assistant: assistant(),
    conversationHistory: [] as ConversationMessage[],
    schema: null,
    busy: false,
    onReset,
    ...props,
  }
  act(() => {
    root.render(<AiAssistantPanel {...full} />)
  })
  return { container, onReset }
}

/** 越界/歧义即抛：让「找不到按钮」是测试失败，而不是被可选链吞成 undefined */
function buttons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button"))
}

/** 发送按钮恒为面板最后一个按钮；再用它自身的尺寸类自检，防止指错目标 */
function sendButton(container: HTMLElement): HTMLButtonElement {
  const all = buttons(container)
  const last = all[all.length - 1]
  if (!last) throw new Error('面板里一个按钮都没有')
  if (!/w-7/.test(last.className)) throw new Error(`最后一个按钮不是发送键：class=${last.className}`)
  return last
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const matched = buttons(container).filter((b) => b.textContent?.trim() === text)
  if (matched.length !== 1) throw new Error(`文本「${text}」的按钮应为 1 个，实际 ${matched.length} 个`)
  return matched[0] as HTMLButtonElement
}

function click(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

afterEach(() => {
  document.body.replaceChildren()
})

describe("AiAssistantPanel", () => {
  it("没有对话历史时显示占位文案，且不出现「重置」", () => {
    const { container } = renderPanel()
    expect(container.textContent).toContain("用自然语言描述你想分析的内容")
    expect(buttons(container).filter((b) => b.textContent?.trim() === "重置")).toHaveLength(0)
  })

  it("有历史时出现「重置」，点击只转回调（会话 RESET 不归本组件）", () => {
    const { container, onReset } = renderPanel({ conversationHistory: [message("user", "对比 @orders 与 @customers 的销售趋势")] })
    click(buttonByText(container, "重置"))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it("busy 或 asking 时「重置」禁用", () => {
    const history = [message("user", "问题")]
    expect(buttonByText(renderPanel({ conversationHistory: history, busy: true }).container, "重置").disabled).toBe(true)
    const asking = renderPanel({ conversationHistory: history, assistant: assistant({ asking: true }) })
    expect(buttonByText(asking.container, "重置").disabled).toBe(true)
  })

  it("AI 未配置时给 .env 指引，不再显示占位文案", () => {
    const { container } = renderPanel({ assistant: assistant({ unavailable: true }) })
    expect(container.textContent).toContain("AI 服务未配置")
    expect(container.textContent).toContain("AI_API_KEY")
    expect(container.textContent).not.toContain("用自然语言描述你想分析的内容")
  })

  it("user 与 assistant 气泡各按角色渲染自己的内容", () => {
    const { container } = renderPanel({
      conversationHistory: [message("user", "用户问题原文"), message("assistant", "助手回答原文")],
    })
    const mine = container.querySelector(".justify-end")
    const theirs = container.querySelector(".justify-start")
    expect(mine?.textContent).toContain("用户问题原文")
    expect(theirs?.textContent).toContain("助手回答原文")
    expect(mine?.textContent).not.toContain("助手回答原文")
  })

  it("asking 时显示「思考中...」", () => {
    expect(renderPanel().container.textContent).not.toContain("思考中")
    const asking = renderPanel({ assistant: assistant({ asking: true, input: "x" }) })
    expect(asking.container.textContent).toContain("思考中")
  })

  it("发送按钮：空输入或 asking 时禁用，有输入时点击调 ask", () => {
    expect(sendButton(renderPanel().container).disabled).toBe(true)

    const ask = vi.fn()
    const typed = renderPanel({ assistant: assistant({ input: "  分析趋势  ", ask }) })
    const send = sendButton(typed.container)
    expect(send.disabled).toBe(false)
    click(send)
    expect(ask).toHaveBeenCalledTimes(1)

    const busy = renderPanel({ assistant: assistant({ input: "分析", ask, asking: true }) })
    expect(sendButton(busy.container).disabled).toBe(true)
  })
})
