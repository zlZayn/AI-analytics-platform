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

const RESPONSE_FORMAT_CHAIN: ResponseFormatMode[] = ["json_schema", "json_object", "none"]

/** AI_RESPONSE_FORMAT 指定起点；未配置或非法值从最强档开始 */
export function parseResponseFormatChain(raw: string | undefined): ResponseFormatMode[] {
  const requested = (raw || "").trim()
  const index = RESPONSE_FORMAT_CHAIN.indexOf(requested as ResponseFormatMode)
  return RESPONSE_FORMAT_CHAIN.slice(index >= 0 ? index : 0)
}

const AI_CONFIG = {
  apiBase: process.env.AI_API_BASE || "",
  apiKey: process.env.AI_API_KEY || "",
  model: process.env.AI_MODEL || "",
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

export interface AICompletionProvider {
  complete(input: {
    messages: AIMessage[]
    responseSchema: typeof AI_RESPONSE_JSON_SCHEMA
    /** 会话标识：同一对话保持稳定，供网关路由与缓存（占位符 {sessionId} 使用） */
    sessionId?: string
  }): Promise<string>
}

export interface AIServiceResult {
  items: InsightItem[]
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
  const content = await provider.complete({
    messages,
    responseSchema: AI_RESPONSE_JSON_SCHEMA,
    sessionId: sessionId || undefined,
  })
  const items = parseInsightItems(content)
  if (items.length === 0) {
    // 解析失败时留可诊断线索（仅服务端日志）：降级到纯提示词约束后，形状漂移会在这里暴露
    console.warn(`[ai] 响应未产生有效洞察（${content.length} 字符）：${content.slice(0, 400)}`)
  }
  return { items }
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
  context: { sessionId?: string; version?: string },
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
          max_tokens: 4000,
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
          const content = choice?.message.content ?? ""
          if (!content.trim()) {
            console.warn(`[ai] 模型返回空内容：finish_reason=${choice?.finish_reason ?? "unknown"} model=${AI_CONFIG.model}`)
          }
          return content
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
