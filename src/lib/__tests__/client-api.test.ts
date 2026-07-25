import { describe, expect, it, vi } from "vitest"

import { fetchApi } from "../client-api"

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
})
