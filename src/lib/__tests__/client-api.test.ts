import { describe, expect, it, vi } from "vitest"

import { ApiRequestError, fetchApi } from "../client-api"

describe("fetchApi", () => {
  it("normalizes non-json HTTP failures into a retryable request error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream failed", { status: 503 })))
    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      code: "HTTP_503",
      retryable: true,
    })
    vi.unstubAllGlobals()
  })

  it("does not turn an aborted request into a user-facing error", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(fetchApi("/api/test", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" })
  })

  it("maps the structured error envelope without legacy fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: { code: "QUERY_TIMEOUT", message: "查询超时", retryable: true },
      requestId: "request-1",
    }), { status: 504, headers: { "content-type": "application/json" } })))

    const error = await fetchApi("/api/test").catch((reason) => reason)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ code: "QUERY_TIMEOUT", message: "查询超时", retryable: true, requestId: "request-1" })
    vi.unstubAllGlobals()
  })

  it("normalizes network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")))
    await expect(fetchApi("/api/test")).rejects.toMatchObject({ code: "NETWORK_ERROR", retryable: true })
    vi.unstubAllGlobals()
  })

  it("distinguishes internal timeout from user cancellation", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn((_input, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true })
    })))

    const request = fetchApi("/api/test", {}, 10)
    const assertion = expect(request).rejects.toMatchObject({ code: "REQUEST_TIMEOUT", retryable: true })
    await vi.advanceTimersByTimeAsync(10)
    await assertion
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})
