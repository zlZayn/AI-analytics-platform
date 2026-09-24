import { describe, expect, it } from "vitest"
import { parseHeaderTemplates, resolveRequestHeaders } from "../ai-config"

describe("parseHeaderTemplates", () => {
  it("解析 JSON 对象，忽略非字符串与空值", () => {
    expect(parseHeaderTemplates('{"x-session":"{sessionId}","count":1,"empty":"","ok":"v"}')).toEqual({
      "x-session": "{sessionId}",
      ok: "v",
    })
  })

  it("未配置、空串、数组与非法 JSON 一律视为未配置", () => {
    expect(parseHeaderTemplates(undefined)).toEqual({})
    expect(parseHeaderTemplates("   ")).toEqual({})
    expect(parseHeaderTemplates("[1,2]")).toEqual({})
    expect(parseHeaderTemplates("{not json}")).toEqual({})
  })
})

describe("resolveRequestHeaders", () => {
  it("替换 {sessionId} 与 {version}，并补默认 User-Agent", () => {
    const headers = resolveRequestHeaders({ "x-gateway-session": "{sessionId}", "X-Env": "app/{version}" }, { sessionId: "conv-1", version: "9.9.9" })

    expect(headers).toEqual({ "x-gateway-session": "conv-1", "X-Env": "app/9.9.9", "User-Agent": "ai-analytics-platform/9.9.9" })
  })

  it("没有会话时丢弃带 {sessionId} 的头，而不是发送空值", () => {
    const headers = resolveRequestHeaders({ "x-gateway-session": "{sessionId}", "X-Keep": "1" }, {})

    expect(headers).toEqual({ "X-Keep": "1", "User-Agent": "ai-analytics-platform/dev" })
  })

  it("模板里已有 User-Agent 时不重复添加", () => {
    const headers = resolveRequestHeaders({ "user-agent": "my-agent/1.0" }, {})

    expect(headers).toEqual({ "user-agent": "my-agent/1.0" })
  })

  it("未配置模板时只发送默认 User-Agent", () => {
    expect(Object.keys(resolveRequestHeaders({}, {}))).toEqual(["User-Agent"])
  })
})
