import { describe, expect, it, vi } from "vitest"
import { PoolRegistry } from "../pool-registry"

function pool() {
  return { end: vi.fn(async () => undefined) }
}

describe("PoolRegistry", () => {
  it("deduplicates concurrent creation and evicts the least recently used pool", async () => {
    let now = 0
    const registry = new PoolRegistry<{ end(): Promise<void> }>({ maxEntries: 2, idleMs: 100, now: () => now })
    const first = pool()
    const createFirst = vi.fn(async () => first)

    const [a, b] = await Promise.all([
      registry.getOrCreate("a", createFirst),
      registry.getOrCreate("a", createFirst),
    ])
    expect(a).toBe(b)
    expect(createFirst).toHaveBeenCalledOnce()

    now = 1
    const second = pool()
    await registry.getOrCreate("b", async () => second)
    now = 2
    await registry.getOrCreate("b", async () => second)
    const third = pool()
    await registry.getOrCreate("c", async () => third)

    expect(first.end).toHaveBeenCalledOnce()
    expect(registry.keys()).toEqual(["b", "c"])
  })

  it("prunes idle pools and closes all remaining entries", async () => {
    let now = 0
    const registry = new PoolRegistry<{ end(): Promise<void> }>({ maxEntries: 3, idleMs: 10, now: () => now })
    const first = pool()
    const second = pool()
    await registry.getOrCreate("a", async () => first)
    now = 5
    await registry.getOrCreate("b", async () => second)
    now = 11

    await registry.pruneIdle()
    expect(first.end).toHaveBeenCalledOnce()
    expect(second.end).not.toHaveBeenCalled()

    await registry.closeAll()
    expect(second.end).toHaveBeenCalledOnce()
    expect(registry.size).toBe(0)
  })
})
