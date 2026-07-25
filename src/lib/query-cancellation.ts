export class QueryCancelledError extends Error {
  readonly code = "QUERY_CANCELLED"

  constructor() {
    super("查询已取消")
    this.name = "QueryCancelledError"
  }
}

export async function executeCancelable<T>(
  start: () => Promise<T>,
  cancel: () => Promise<void>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new QueryCancelledError()

  let cancelled = false
  let cancellation: Promise<void> | undefined
  const onAbort = () => {
    if (cancelled) return
    cancelled = true
    cancellation = cancel()
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    const value = await start()
    if (cancelled) {
      await cancellation
      throw new QueryCancelledError()
    }
    return value
  } catch (error) {
    if (cancelled) {
      await cancellation?.catch(() => undefined)
      throw new QueryCancelledError()
    }
    throw error
  } finally {
    signal?.removeEventListener("abort", onAbort)
  }
}
