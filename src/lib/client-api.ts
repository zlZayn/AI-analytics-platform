export class ApiRequestError extends Error {
  readonly code: string
  readonly status?: number
  readonly retryable: boolean

  constructor(message: string, code: string, retryable: boolean, status?: number) {
    super(message)
    this.name = "ApiRequestError"
    this.code = code
    this.retryable = retryable
    this.status = status
  }
}

export async function fetchApi<T = unknown>(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  if (init.signal?.aborted) throw new DOMException("请求已取消", "AbortError")
  const controller = new AbortController()
  const abort = () => controller.abort()
  init.signal?.addEventListener("abort", abort, { once: true })
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    let payload: unknown = null
    try { payload = await response.json() } catch { payload = null }
    if (!response.ok) {
      const body = payload as { error?: string; errorInfo?: { code?: string; retryable?: boolean } } | null
      throw new ApiRequestError(
        body?.error || `请求失败 (${response.status})`,
        body?.errorInfo?.code || `HTTP_${response.status}`,
        body?.errorInfo?.retryable ?? response.status >= 500,
        response.status,
      )
    }
    return payload as T
  } finally {
    window.clearTimeout(timer)
    init.signal?.removeEventListener("abort", abort)
  }
}
