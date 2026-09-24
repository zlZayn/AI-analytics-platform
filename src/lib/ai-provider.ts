import OpenAI from "openai"
import { AI_RESPONSE_JSON_SCHEMA } from "./ai-contract"
import { AI_CONFIG, AIConfigurationError, resolveRequestHeaders, type ResponseFormatMode } from "./ai-config"

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

let defaultProvider: AICompletionProvider | null = null

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

export function getDefaultProvider(): AICompletionProvider {
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
        const body = buildRequestBody(mode, messages, responseSchema)
        try {
          const response = await client.chat.completions.create(body, { headers })
          availableFormats = chain.slice(index)
          if (index > 0) console.warn(`[ai] 使用降级的 response_format=${mode}`)
          return toCompletion(response)
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

/** response_format 三种模式的请求体差异集中在这里：降级链只关心顺序 */
function buildRequestBody(
  mode: ResponseFormatMode | undefined,
  messages: AIMessage[],
  responseSchema: typeof AI_RESPONSE_JSON_SCHEMA,
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
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
  return body
}

/** SDK 响应 → 一次补全：choices[0] 可能不存在，取不到就当空内容 */
function toCompletion(response: OpenAI.Chat.Completions.ChatCompletion): AICompletion {
  const choice = response.choices[0]
  return {
    content: choice?.message.content ?? "",
    finishReason: choice?.finish_reason ?? "unknown",
    usage: mapUsage(response.usage),
  }
}
