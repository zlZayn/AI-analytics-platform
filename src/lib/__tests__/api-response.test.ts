import { describe, expect, it } from "vitest"
import { apiFailure, apiSuccess } from "../api-response"

describe("API response contract", () => {
  it("returns discriminated success and failure envelopes", async () => {
    const success = await apiSuccess({ value: 1 }, { cached: true }, "request-success").json()
    expect(success).toEqual({ success: true, data: { value: 1 }, meta: { cached: true }, requestId: "request-success" })

    const failureResponse = apiFailure({ code: "INVALID_REQUEST", message: "请求无效", retryable: false }, 400, "request-failure")
    expect(failureResponse.status).toBe(400)
    await expect(failureResponse.json()).resolves.toEqual({
      success: false,
      error: { code: "INVALID_REQUEST", message: "请求无效", retryable: false },
      requestId: "request-failure",
    })
  })
})
