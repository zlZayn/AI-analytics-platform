import { describe, expect, it } from "vitest"
import { parseResponseFormatChain } from "../ai-config"
import { isResponseFormatUnsupported } from "../ai-provider"

describe("parseResponseFormatChain", () => {
  it("默认从原生 JSON Schema 起，逐级降级到提示词约束", () => {
    expect(parseResponseFormatChain(undefined)).toEqual(["json_schema", "json_object", "none"])
    expect(parseResponseFormatChain("json_schema")).toEqual(["json_schema", "json_object", "none"])
  })

  it("显式指定起点时跳过更强的档位", () => {
    expect(parseResponseFormatChain("json_object")).toEqual(["json_object", "none"])
    expect(parseResponseFormatChain("none")).toEqual(["none"])
  })

  it("非法或空白值回退到最强档", () => {
    expect(parseResponseFormatChain("yaml")).toEqual(["json_schema", "json_object", "none"])
    expect(parseResponseFormatChain("  ")).toEqual(["json_schema", "json_object", "none"])
  })
})

describe("isResponseFormatUnsupported", () => {
  it("识别提供方拒绝 response_format 的错误", () => {
    const error = Object.assign(new Error("Error from provider (Console Go): Upstream request failed: This response_format type is unavailable now"), {
      status: 400,
      type: "invalid_request_error",
    })

    expect(isResponseFormatUnsupported(error)).toBe(true)
  })

  it("其他错误不触发降级", () => {
    expect(isResponseFormatUnsupported(new Error("Request is missing x-opencode-session"))).toBe(false)
    expect(isResponseFormatUnsupported(new Error("Incorrect API key provided"))).toBe(false)
  })
})
