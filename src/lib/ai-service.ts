import { AI_RESPONSE_JSON_SCHEMA, buildSystemPrompt, type InsightItem } from "./ai-contract"
import { parseInsightItems } from "./ai-contract-parse"
import { getDefaultProvider, type AICompletion, type AICompletionProvider, type AIMessage } from "./ai-provider"
import { describeOutcome, type AIOutcomeReason, type AIServiceResult } from "./ai-outcome"

export async function generateAnalysis(
  message: string,
  schemaContext: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  provider: AICompletionProvider = getDefaultProvider(),
  dataProfileText = "",
  businessContext = "",
  sessionId = "",
): Promise<AIServiceResult> {
  const messages: AIMessage[] = [
    { role: "system", content: buildSystemPrompt(schemaContext, dataProfileText, businessContext) },
    ...conversationHistory,
    { role: "user", content: message },
  ]
  const first = await attemptAnalysis(provider, messages, sessionId)
  if (first.outcome.reason === "ok") return buildOkResult(first, 1)

  // 有界修复：官方指出 json_object 存在空响应概率，推理模型也容易把 JSON 砍半句。
  // 只追加一条纠正指令再问一次（不是 agent loop，不引入工具与多轮规划）。
  warnUnusable("首次输出不可用", first)
  const retry = await attemptAnalysis(provider, withRetryInstruction(messages, first.outcome.reason), sessionId)
  if (retry.outcome.reason === "ok") return buildOkResult(retry, 2)
  warnUnusable("修复后仍不可用", retry)
  return buildRetryFailureResult(retry.completion, retry.outcome)
}

/** 一次补全的完整链路：调用 → 解析 → 分类。首问与有界修复走同一条 */
interface AnalysisAttempt {
  completion: AICompletion
  items: InsightItem[]
  outcome: ReturnType<typeof describeOutcome>
}

async function attemptAnalysis(
  provider: AICompletionProvider,
  messages: AIMessage[],
  sessionId: string,
): Promise<AnalysisAttempt> {
  const completion = await provider.complete({
    messages,
    responseSchema: AI_RESPONSE_JSON_SCHEMA,
    sessionId: sessionId || undefined,
  })
  const items = parseInsightItems(completion.content)
  return {
    completion,
    items,
    outcome: describeOutcome({
      content: completion.content,
      finishReason: completion.finishReason,
      items,
    }),
  }
}

/** 合格终态：首问与修复后只差 attempts */
function buildOkResult(attempt: AnalysisAttempt, attempts: number): AIServiceResult {
  return {
    items: attempt.items,
    reason: "ok",
    message: "",
    attempts,
    finishReason: attempt.completion.finishReason,
    usage: attempt.completion.usage,
  }
}

/** 服务端日志：分类 + 提供方元信息 + 原始片段，两阶段共用一句模板 */
function warnUnusable(stage: string, attempt: AnalysisAttempt): void {
  console.warn(
    `[ai] ${stage}（${attempt.outcome.reason}，finish=${attempt.completion.finishReason}，${attempt.completion.content.length} 字符）：${attempt.outcome.rawPreview}`,
  )
}

/** 有界修复只追加这一条纠正指令（不是 agent loop，不引入工具与多轮规划） */
function withRetryInstruction(messages: AIMessage[], reason: AIOutcomeReason): AIMessage[] {
  return [
    ...messages,
    {
      role: "user",
      content: `上一次输出未通过解析（${reason}）。请只输出 1 条 items，insight 不超过 120 字，确保 JSON 完整闭合后再结束。`,
    },
  ]
}

/** 两次都不合格的终态：items 留空，分类与原始片段取第二次的 */
function buildRetryFailureResult(
  completion: AICompletion,
  outcome: ReturnType<typeof describeOutcome>,
): AIServiceResult {
  return {
    items: [],
    reason: outcome.reason,
    message: outcome.message,
    attempts: 2,
    finishReason: completion.finishReason,
    usage: completion.usage,
    rawPreview: outcome.rawPreview,
  }
}
