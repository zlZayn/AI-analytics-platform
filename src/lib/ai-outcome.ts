import type { InsightItem } from "./ai-contract"
import type { AIUsage } from "./ai-provider"

/** 解析失败的分类：决定给用户哪一句话，也决定日志怎么筛 */
export type AIOutcomeReason = "ok" | "empty" | "truncated" | "invalid_json" | "no_valid_item"

export interface AIServiceResult {
  items: InsightItem[]
  reason: AIOutcomeReason
  /** 面向用户的一句话：后端给，界面直接显示，前端不做判断 */
  message: string
  /** 实际调用次数（1 = 一次成功；2 = 触发过有界修复） */
  attempts: number
  finishReason?: string | undefined
  usage?: AIUsage | undefined
  /** 失败时的原始响应片段：只给服务端日志，不回传客户端 */
  rawPreview?: string | undefined
}

const OUTCOME_MESSAGES: Record<AIOutcomeReason, string> = {
  ok: "",
  empty: "AI 未返回内容（提供方偶发空响应），请再试一次",
  truncated: "AI 输出被截断（达到输出上限），把问题拆小一点再问一次",
  invalid_json: "AI 返回的不是合法 JSON，请换个更具体的问法再试",
  no_valid_item: "AI 的返回不符合输出契约，已丢弃；换个更具体的问法再试",
}

/** 按官方 JSON Output 的建议给出失败分类与用户可见原因 */
export function describeOutcome(input: {
  content: string
  finishReason?: string | undefined
  items: InsightItem[]
}): { reason: AIOutcomeReason; message: string; rawPreview?: string | undefined } {
  if (input.items.length > 0) return { reason: "ok", message: OUTCOME_MESSAGES.ok }
  const rawPreview = input.content.slice(0, 400)
  if (!input.content.trim()) return { reason: "empty", message: OUTCOME_MESSAGES.empty, rawPreview }
  if (input.finishReason === "length") return { reason: "truncated", message: OUTCOME_MESSAGES.truncated, rawPreview }
  try {
    JSON.parse(input.content)
  } catch {
    return { reason: "invalid_json", message: OUTCOME_MESSAGES.invalid_json, rawPreview }
  }
  return { reason: "no_valid_item", message: OUTCOME_MESSAGES.no_valid_item, rawPreview }
}

/** 回传客户端的诊断：只给分类与一句话，不带原始响应 */
export function toClientDiagnostics(result: AIServiceResult): {
  reason: AIOutcomeReason
  message: string
  attempts: number
} {
  return { reason: result.reason, message: result.message, attempts: result.attempts }
}
