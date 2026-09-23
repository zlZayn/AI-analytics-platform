import OpenAI from "openai"
import {
  AI_RESPONSE_JSON_SCHEMA,
  buildSystemPrompt,
  parseInsightItems,
  type InsightItem,
} from "./ai-contract"

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev"

/**
 * 结构化输出档位：原生 strict JSON Schema → 通用 JSON 模式 → 仅提示词约束
 * 降级只在提供方明确拒绝 response_format 时发生，且进程内记住可用档位；运行时契约校验始终执行
 */
export type ResponseFormatMode = "json_schema" | "json_object" | "none"

const RESPONSE_FORMAT_CHAIN = ["json_schema", "json_object", "none"] as const satisfies readonly ResponseFormatMode[]

/** AI_RESPONSE_FORMAT 指定起点；未配置或非法值从最强档开始 */
export function parseResponseFormatChain(raw: string | undefined): ResponseFormatMode[] {
  const requested = (raw || "").trim()
  const index = RESPONSE_FORMAT_CHAIN.indexOf(requested as ResponseFormatMode)
  return RESPONSE_FORMAT_CHAIN.slice(index >= 0 ? index : 0)
}

/**
 * 输出预算：推理模型的 reasoning token 也算在这里，预算过小会把 JSON 砍在半句。
 * 默认 8000（实测 deepseek-flash 一条 6 项回答约用 2600 completion token，其中 1700 是推理）。
 */
export function parseMaxTokens(raw: string | undefined): number {
  const parsed = Number.parseInt((raw || "").trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 1000) return 8000
  return Math.min(parsed, 32_000)
}

const AI_CONFIG = {
  apiBase: process.env.AI_API_BASE || "",
  apiKey: process.env.AI_API_KEY || "",
  model: process.env.AI_MODEL || "",
  maxTokens: parseMaxTokens(process.env.AI_MAX_TOKENS),
  /** 请求头模板（JSON）：值支持 {sessionId}/{version} 占位符，代码不内置任何网关专属头名 */
  headers: parseHeaderTemplates(process.env.AI_API_HEADERS),
  /** 结构化输出档位起点（默认从原生 strict schema 起，按需降级） */
  formatChain: parseResponseFormatChain(process.env.AI_RESPONSE_FORMAT),
}

/** 未配置或缺凭据：路由据此返回可操作错误，而不是「稍后重试」 */
export class AIConfigurationError extends Error {}

/** 提供方是否明确拒绝当前 response_format（可降级的判定） */
export function isResponseFormatUnsupported(error: unknown): boolean {
  return /response[_ ]format/i.test(describeAIError(error))
}

export interface AIMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AIUsage {
  promptTokens?: number | undefined
  completionTokens?: number | undefined
  /** 推理模型的可见输出之外的开销：预算被它吃掉是截断的常见原因 */
  reasoningTokens?: number | undefined
  totalTokens?: number | undefined
}

/** 一次补全：内容 + 提供方元信息（诊断与有界重试都依赖它） */
export interface AICompletion {
  content: string
  finishReason: string
  usage?: AIUsage | undefined
}

export interface AICompletionProvider {
  complete(input: {
    messages: AIMessage[]
    responseSchema: typeof AI_RESPONSE_JSON_SCHEMA
    /** 会话标识：同一对话保持稳定，供网关路由与缓存（占位符 {sessionId} 使用） */
    sessionId?: string | undefined
  }): Promise<AICompletion>
}

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

let defaultProvider: AICompletionProvider | null = null

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
  const completion = await provider.complete({
    messages,
    responseSchema: AI_RESPONSE_JSON_SCHEMA,
    sessionId: sessionId || undefined,
  })
  const items = parseInsightItems(completion.content)
  const outcome = describeOutcome({
    content: completion.content,
    finishReason: completion.finishReason,
    items,
  })
  if (outcome.reason === "ok") {
    return { items, reason: "ok", message: "", attempts: 1, finishReason: completion.finishReason, usage: completion.usage }
  }

  // 有界修复：官方指出 json_object 存在空响应概率，推理模型也容易把 JSON 砍半句。
  // 只追加一条纠正指令再问一次（不是 agent loop，不引入工具与多轮规划）。
  console.warn(
    `[ai] 首次输出不可用（${outcome.reason}，finish=${completion.finishReason}，${completion.content.length} 字符）：${outcome.rawPreview}`,
  )
  const retryMessages: AIMessage[] = [
    ...messages,
    {
      role: "user",
      content: `上一次输出未通过解析（${outcome.reason}）。请只输出 1 条 items，insight 不超过 120 字，确保 JSON 完整闭合后再结束。`,
    },
  ]
  const retry = await provider.complete({
    messages: retryMessages,
    responseSchema: AI_RESPONSE_JSON_SCHEMA,
    sessionId: sessionId || undefined,
  })
  const retryItems = parseInsightItems(retry.content)
  const retryOutcome = describeOutcome({
    content: retry.content,
    finishReason: retry.finishReason,
    items: retryItems,
  })
  if (retryOutcome.reason === "ok") {
    return { items: retryItems, reason: "ok", message: "", attempts: 2, finishReason: retry.finishReason, usage: retry.usage }
  }
  console.warn(
    `[ai] 修复后仍不可用（${retryOutcome.reason}，finish=${retry.finishReason}，${retry.content.length} 字符）：${retryOutcome.rawPreview}`,
  )
  return {
    items: [],
    reason: retryOutcome.reason,
    message: retryOutcome.message,
    attempts: 2,
    finishReason: retry.finishReason,
    usage: retry.usage,
    rawPreview: retryOutcome.rawPreview,
  }
}

/**
 * AI_API_HEADERS：JSON 对象文本 → 请求头模板
 * 忽略非字符串与空值；非法 JSON 视为未配置（不阻断调用）
 */
export function parseHeaderTemplates(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
        .map(([name, value]) => [name, value]),
    )
  } catch {
    return {}
  }
}

/**
 * 求值请求头：替换 {sessionId}/{version} 占位符
 * - 占位符无值可用（如本次请求没有会话）时整条丢弃，不发送空头
 * - 结果中没有 User-Agent 时补默认标识（大小写不敏感）
 */
export function resolveRequestHeaders(
  templates: Record<string, string>,
  context: { sessionId?: string | undefined; version?: string | undefined },
): Record<string, string> {
  const version = context.version ?? APP_VERSION
  const headers: Record<string, string> = {}
  for (const [name, template] of Object.entries(templates)) {
    let value = template.replace(/\{version\}/g, version)
    if (value.includes("{sessionId}")) {
      if (!context.sessionId) continue
      value = value.replace(/\{sessionId\}/g, context.sessionId)
    }
    if (value.length > 0) headers[name] = value
  }
  if (!Object.keys(headers).some((name) => name.toLowerCase() === "user-agent")) {
    headers["User-Agent"] = `ai-analytics-platform/${version}`
  }
  return headers
}

/** 上游错误 → 用户可见说明：保留 HTTP 状态、错误类型与提供方原文，并抹掉可能的密钥片段 */
export function describeAIError(error: unknown): string {
  if (!(error instanceof Error)) return redactSecrets(String(error)).slice(0, 300)
  const detail = error as Error & { status?: unknown; type?: unknown; error?: unknown }
  const parts: string[] = []
  if (typeof detail.status === "number") parts.push(`HTTP ${detail.status}`)
  if (typeof detail.type === "string" && detail.type) parts.push(detail.type)
  const body = detail.error
  const providerMessage =
    typeof body === "string"
      ? body
      : body && typeof body === "object" && "message" in body && typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : ""
  parts.push(providerMessage || detail.message)
  return redactSecrets(parts.filter(Boolean).join("：")).slice(0, 300)
}

function redactSecrets(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-***")
}

/** SDK usage → 我们关心的四元组（含推理 token） */
function mapUsage(usage: unknown): AIUsage | undefined {
  if (!usage || typeof usage !== "object") return undefined
  const raw = usage as {
    prompt_tokens?: unknown
    completion_tokens?: unknown
    total_tokens?: unknown
    completion_tokens_details?: { reasoning_tokens?: unknown }
  }
  const toNumber = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined)
  return {
    promptTokens: toNumber(raw.prompt_tokens),
    completionTokens: toNumber(raw.completion_tokens),
    reasoningTokens: toNumber(raw.completion_tokens_details?.reasoning_tokens),
    totalTokens: toNumber(raw.total_tokens),
  }
}

function getDefaultProvider(): AICompletionProvider {
  if (!AI_CONFIG.apiBase) {
    throw new AIConfigurationError("AI 服务未配置：缺少 API Base。请在 .env 文件中设置 AI_API_BASE。")
  }
  if (!AI_CONFIG.apiKey) {
    throw new AIConfigurationError("AI 服务未配置：缺少 API Key。请在 .env 文件中设置 AI_API_KEY。")
  }
  if (!AI_CONFIG.model) {
    throw new AIConfigurationError("AI 服务未配置：缺少模型。请在 .env 文件中设置 AI_MODEL。")
  }
  if (!defaultProvider) defaultProvider = createOpenAIProvider()
  return defaultProvider
}

function createOpenAIProvider(): AICompletionProvider {
  const client = new OpenAI({ baseURL: AI_CONFIG.apiBase, apiKey: AI_CONFIG.apiKey })
  // 进程内探测结果：命中后不再对每个请求重复试探
  let availableFormats: ResponseFormatMode[] | null = null
  return {
    async complete({ messages, responseSchema, sessionId }) {
      const headers = resolveRequestHeaders(AI_CONFIG.headers, { sessionId })
      const chain = availableFormats ?? AI_CONFIG.formatChain
      let lastError: unknown
      for (let index = 0; index < chain.length; index += 1) {
        const mode = chain[index]
        const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
          model: AI_CONFIG.model,
          messages,
          temperature: 0.2,
          max_tokens: AI_CONFIG.maxTokens,
        }
        if (mode === "json_object") body.response_format = { type: "json_object" }
        if (mode === "json_schema") {
          body.response_format = { type: "json_schema", json_schema: responseSchema }
        }
        try {
          const response = await client.chat.completions.create(body, { headers })
          availableFormats = chain.slice(index)
          if (index > 0) console.warn(`[ai] 使用降级的 response_format=${mode}`)
          const choice = response.choices[0]
          return {
            content: choice?.message.content ?? "",
            finishReason: choice?.finish_reason ?? "unknown",
            usage: mapUsage(response.usage),
          }
        } catch (error) {
          lastError = error
          const next = chain[index + 1]
          if (!next || !isResponseFormatUnsupported(error)) throw error
          console.warn(`[ai] response_format=${mode} 被提供方拒绝，降级为 ${next}：${describeAIError(error)}`)
        }
      }
      throw lastError
    },
  }
}

export type { InsightItem } from "./ai-contract"
