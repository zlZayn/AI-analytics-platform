"use client"

// AI 助手编排（从 SessionWorkspace 抽出的唯一实现）
//
// 职责：输入/提问状态、请求 /api/ai、把结果映射成会话 action。
// 不负责：会话状态本身（仍是 AnalysisSession 唯一真相）、界面渲染、结果区 Tab 布局。
// 结果→action 的映射是纯函数（lib/ai-session-mapping.ts），本 Hook 只做状态与请求。

import { useState } from "react"
import type { InsightItem } from "@/lib/ai-contract"
import { buildInitFromAi, describeAskFailure, fallbackSqlOf } from "@/lib/ai-session-mapping"
import { ApiRequestError, fetchApi } from "@/lib/client-api"
import { extractMentions } from "@/lib/mention"
import { appendHistory } from "@/lib/history-store"
import type { ApiResponse } from "@/types"
import type { SessionAction } from "@/types/actions"
import type { AnalysisSession, ConversationMessage } from "@/types/session"

export type AssistantTone = "success" | "warning" | "error"

export interface UseAiAssistantOptions {
  connectionId: string | null
  /** 会话状态：读 id / conversationHistory，写一律经 dispatch(SessionAction) */
  session: AnalysisSession
  dispatch: (action: SessionAction) => void
  /** 回退路径把 AI 生成的 SQL 写回编辑器草稿 */
  onSqlDraft: (sql: string) => void
  onTabChange: (tab: string) => void
  notify: (message: string, tone: AssistantTone) => void
  /** 恢复出来的洞察流（工作台持久化，见 lib/workspace-store.ts） */
  initialInsights?: InsightItem[]
}

export interface AiAssistant {
  input: string
  setInput: (value: string) => void
  asking: boolean
  /** 配置缺失（AI_NOT_CONFIGURED）：界面显示 .env 指引 */
  unavailable: boolean
  /** 本轮返回的全部洞察（结论前置，第一条自动执行） */
  insights: InsightItem[]
  executingIndex: number | null
  /** 当前已载入会话的洞察索引（其 SQL 即会话的 compiledSql；未执行过为 null） */
  activeInsightIndex: number | null
  ask: () => Promise<void>
  execute: (index: number) => void
  /** 清空洞察流（会话 RESET 由调用方决定） */
  clearInsights: () => void
}


function assistantMessage(content: string): ConversationMessage {
  return { role: "assistant", content, createdAt: new Date() }
}

export function useAiAssistant({
  connectionId,
  session,
  dispatch,
  onSqlDraft,
  onTabChange,
  notify,
  initialInsights,
}: UseAiAssistantOptions): AiAssistant {
  const [input, setInput] = useState("")
  const [asking, setAsking] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [insights, setInsights] = useState<InsightItem[]>(initialInsights ?? [])
  const [executingIndex, setExecutingIndex] = useState<number | null>(null)
  const [activeInsightIndex, setActiveInsightIndex] = useState<number | null>(null)

  /** 把一条洞察写进会话：首条与卡片执行共用同一映射。无可执行内容时返回 false（不动会话状态） */
  function applyInsight(item: InsightItem, question: string, index: number): boolean {
    const fallback = fallbackSqlOf(item)
    if (!item.querySpec?.table && !fallback) return false
    dispatch({ type: "INIT_FROM_AI", payload: buildInitFromAi(item, question) })
    if (fallback) {
      dispatch({ type: "SET_COMPILED_SQL", compiledSql: fallback })
      onSqlDraft(fallback.sql)
    }
    setActiveInsightIndex(index)
    return true
  }

  async function ask() {
    const question = input.trim()
    if (!connectionId || !question || asking) return
    setInput("")
    // 记录用户提问（含会话上下文），随后调用 AI
    dispatch({ type: "ASK_AI", question })
    setAsking(true)
    try {
      const data = await fetchApi<
        ApiResponse<{ items: InsightItem[]; diagnostics?: { reason: string; message: string; attempts: number } }>
      >("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          // 会话标识：AI 网关据此路由与缓存（请求头模板的 {sessionId} 占位符消费）
          conversationId: session.id,
          message: question,
          // 携带会话上下文（上一轮及之前的历史），实现多轮对话；本次提问由后端拼在最后
          conversationHistory: session.conversationHistory.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          // @提及的表作为显式上下文：只扫这些表的数据轮廓
          referencedTables: extractMentions(question),
        }),
      })
      if (!data.success) {
        throw new ApiRequestError(data.error.message || "AI 分析失败", data.error.code, data.error.retryable)
      }
      const items = data.data.items
      if (items.length === 0) {
        appendHistory({
          kind: "ai",
          connectionId,
          sessionId: session.id,
          question,
          ok: false,
          summary: data.data.diagnostics?.message || "AI 未生成有效结果",
          items: [],
        })
        // 失败原因由后端给出（空响应 / 截断 / 非法 JSON / 不符合契约），前端只负责显示
        const hint = data.data.diagnostics?.message || "AI 未生成有效结果"
        dispatch({ type: "ADD_CONVERSATION", message: assistantMessage(hint) })
        notify(hint, "warning")
        return
      }
      // 多洞察全部保留（洞察视图卡片流），第一条自动执行（结论前置）
      setInsights(items)
      onTabChange("insights")
      const ran = applyInsight(items[0], question, 0)
      dispatch({ type: "ADD_CONVERSATION", message: assistantMessage(items[0].insight || items[0].title) })
      notify(
        ran
          ? `已生成 ${items.length} 条分析，执行第 1 条`
          : `已生成 ${items.length} 条分析；第 1 条无可执行 SQL，可展开复制`,
        ran ? "success" : "warning",
      )
      appendHistory({
        kind: "ai",
        connectionId,
        sessionId: session.id,
        question,
        ok: true,
        summary: items[0].insight || items[0].title,
        items,
      })
    } catch (error) {
      const { message, notConfigured } = describeAskFailure(error)
      dispatch({ type: "ADD_CONVERSATION", message: assistantMessage(message) })
      appendHistory({ kind: "ai", connectionId, sessionId: session.id, question, ok: false, summary: message, items: [] })
      if (notConfigured) {
        setUnavailable(true)
        notify("AI 服务未配置，请在 .env 文件中设置 AI_API_KEY", "warning")
      }
    } finally {
      setAsking(false)
    }
  }

  function execute(index: number) {
    const item = insights[index]
    if (!item) {
      setExecutingIndex(null)
      return
    }
    if (!applyInsight(item, item.title, index)) {
      setExecutingIndex(null)
      notify(item.notice ?? "该洞察没有可执行 SQL，可展开复制后到 SQL 编辑器运行", "warning")
      return
    }
    setExecutingIndex(index)
  }

  function clearInsights() {
    setInsights([])
    setExecutingIndex(null)
    setActiveInsightIndex(null)
  }

  return {
    input,
    setInput,
    asking,
    unavailable,
    insights,
    executingIndex,
    activeInsightIndex,
    ask,
    execute,
    clearInsights,
  }
}
