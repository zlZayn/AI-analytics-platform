interface ErrorEnvelope {
  success: false
  error: { code: string; message: string; retryable: boolean }
  requestId?: string
}

export class ApiRequestError extends Error {
  readonly code: string
  readonly status?: number
  readonly retryable: boolean
  readonly requestId?: string

  constructor(message: string, code: string, retryable: boolean, status?: number, requestId?: string) {
    super(message)
    this.name = "ApiRequestError"
    this.code = code
    this.retryable = retryable
    this.status = status
    this.requestId = requestId
  }
}

export async function fetchApi<T = unknown>(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  if (init.signal?.aborted) throw new DOMException("请求已取消", "AbortError")
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  init.signal?.addEventListener("abort", abort, { once: true })
  const timer = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    const payload = await readJson(response)
    if (!response.ok) {
      const envelope = asErrorEnvelope(payload)
      throw new ApiRequestError(
        envelope?.error.message ?? `请求失败 (${response.status})`,
        envelope?.error.code ?? `HTTP_${response.status}`,
        envelope?.error.retryable ?? response.status >= 500,
        response.status,
        envelope?.requestId,
      )
    }
    if (payload === null) {
      throw new ApiRequestError("服务返回了无法解析的响应", "INVALID_RESPONSE", true, response.status)
    }
    return payload as T
  } catch (error) {
    if (error instanceof ApiRequestError) throw error
    if (init.signal?.aborted) throw new DOMException("请求已取消", "AbortError")
    if (timedOut) throw new ApiRequestError("请求超时，请重试", "REQUEST_TIMEOUT", true)
    throw new ApiRequestError("网络连接失败，请检查网络后重试", "NETWORK_ERROR", true)
  } finally {
    globalThis.clearTimeout(timer)
    init.signal?.removeEventListener("abort", abort)
  }
}

async function readJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function asErrorEnvelope(value: unknown): ErrorEnvelope | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<ErrorEnvelope>
  const error = candidate.error
  if (candidate.success !== false || !error || typeof error !== "object") return null
  if (typeof error.code !== "string" || typeof error.message !== "string" || typeof error.retryable !== "boolean") return null
  return candidate as ErrorEnvelope
}
