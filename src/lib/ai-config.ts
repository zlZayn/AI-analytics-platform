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

export const AI_CONFIG = {
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
