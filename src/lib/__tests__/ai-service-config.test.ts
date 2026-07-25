import { afterEach, describe, expect, it, vi } from "vitest"

const originalEnvironment = {
  apiBase: process.env.AI_API_BASE,
  apiKey: process.env.AI_API_KEY,
  model: process.env.AI_MODEL,
}
const originalFetch = globalThis.fetch

describe("default AI provider configuration", () => {
  afterEach(() => {
    restoreEnvironment("AI_API_BASE", originalEnvironment.apiBase)
    restoreEnvironment("AI_API_KEY", originalEnvironment.apiKey)
    restoreEnvironment("AI_MODEL", originalEnvironment.model)
    globalThis.fetch = originalFetch
    vi.resetModules()
  })

  it("rejects a missing AI_API_BASE before making a network request", async () => {
    delete process.env.AI_API_BASE
    process.env.AI_API_KEY = "offline-test-key"
    process.env.AI_MODEL = "offline-test-model"
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network must not be called"))
    vi.resetModules()
    const { generateSQL } = await import("../ai-service")

    await expect(generateSQL("test", "public.items(id integer)")).rejects.toThrow(
      "AI_API_BASE",
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("rejects a missing AI_MODEL before making a network request", async () => {
    process.env.AI_API_BASE = "http://127.0.0.1:1/v1"
    process.env.AI_API_KEY = "offline-test-key"
    delete process.env.AI_MODEL
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network must not be called"))
    vi.resetModules()
    const { generateSQL } = await import("../ai-service")

    await expect(generateSQL("test", "public.items(id integer)")).rejects.toThrow(
      "AI_MODEL",
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
