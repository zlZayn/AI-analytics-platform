import { describe, expect, it, vi, beforeEach } from "vitest"
import { WebRClient, INJECT_CELL_THRESHOLD, withTimeout, safeOutputData } from "@/lib/webr-client"
import type { WebR } from "webr"
import type { SemanticDataset } from "@/types/session"

// 假 WebR：模拟 init/Shelter/evalR/installPackages/interrupt
function createFakeWebR() {
  const shelter = {
    captureR: vi.fn(async (code: string) => ({
      result: {},
      output: [{ type: "stdout", data: `[1] ${code.length}` }],
      images: [] as ImageBitmap[],
    })),
    purge: vi.fn(async () => {}),
  }
  // Shelter 必须用 function 实现（WebRClient 以 `new webR.Shelter()` 调用）
  const webR = {
    init: vi.fn(async () => {}),
    Shelter: vi.fn(function (this: unknown) {
      return shelter
    }),
    evalR: vi.fn<(code: string) => Promise<void>>(async () => {}),
    installPackages: vi.fn<(pkgs: string[]) => Promise<void>>(async () => {}),
    interrupt: vi.fn(async () => {}),
  }
  return { webR, shelter }
}

const smallDataset: SemanticDataset = {
  columns: [
    { name: "sales", type: "float8", semanticType: "numeric" },
    { name: "region", type: "varchar", semanticType: "categorical" },
  ],
  rows: [
    { sales: 1, region: "A" },
    { sales: 2, region: "B" },
  ],
  rowCount: 2,
  executionTimeMs: 5,
  returnedRowCount: 2,
  truncated: false,
  rowLimit: 5000,
}

describe("WebRClient", () => {
  let fake: ReturnType<typeof createFakeWebR>
  let constructed: number

  function makeClient() {
    fake = createFakeWebR()
    constructed = 0
    class FakeWebR {
      init = fake.webR.init
      Shelter = fake.webR.Shelter
      evalR = fake.webR.evalR
      installPackages = fake.webR.installPackages
      interrupt = fake.webR.interrupt
      constructor() {
        constructed += 1
      }
    }
    return { client: new WebRClient({ WebRImpl: FakeWebR as unknown as typeof WebR }), constructed: () => constructed }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("init is idempotent (single instance)", async () => {
    const { client, constructed } = makeClient()
    await client.init()
    await client.init()
    expect(client.getState().status).toBe("ready")
    expect(constructed()).toBe(1)
  })

  it("init failure sets error status", async () => {
    const { client } = makeClient()
    fake.webR.init.mockRejectedValueOnce(new Error("boot fail"))
    await expect(client.init()).rejects.toThrow("boot fail")
    expect(client.getState().status).toBe("error")
    expect(client.getState().error).toContain("boot fail")
  })

  it("execute appends stdout output", async () => {
    const { client } = makeClient()
    await client.init()
    await client.execute("1 + 1")
    const s = client.getState()
    expect(s.output).toHaveLength(1)
    expect(s.output[0].type).toBe("stdout")
    expect(s.lastExecMs).not.toBeNull()
    expect(s.busy).toBe(false)
  })

  it("execute failure surfaces as error output without throwing", async () => {
    const { client } = makeClient()
    await client.init()
    fake.shelter.captureR.mockRejectedValueOnce(new Error("boom"))
    await client.execute("stop()")
    expect(client.getState().output.some((o) => o.type === "error" && o.data === "boom")).toBe(true)
  })

  it("execute before init writes error output without throwing", async () => {
    const { client } = makeClient()
    await expect(client.execute("1 + 1")).resolves.toBeUndefined()
    const s = client.getState()
    expect(s.output.some((o) => o.type === "error" && o.data.includes("未就绪"))).toBe(true)
    expect(s.busy).toBe(false)
    expect(s.lastExecMs).toBeNull()
  })

  it("output items carry unique incrementing ids", async () => {
    const { client } = makeClient()
    client.reportError("e1")
    await client.execute("1") // 未初始化：追加 error 项
    client.reportError("e2")
    const ids = client.getState().output.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    expect(ids[0]).toBeGreaterThan(0)
  })

  it("reportError appends an error output item", async () => {
    const { client } = makeClient()
    client.reportError("boot failed: no network")
    expect(client.getState().output.some((o) => o.type === "error" && o.data === "boot failed: no network")).toBe(true)
  })

  it("ensurePackages installs missing packages once", async () => {
    const { client } = makeClient()
    await client.init()
    await client.ensurePackages(["dplyr", "ggplot2"])
    await client.ensurePackages(["dplyr"])
    expect(client.getState().packages).toEqual(["dplyr", "ggplot2"])
    expect(fake.webR.installPackages).toHaveBeenCalledTimes(1)
    expect(fake.webR.installPackages).toHaveBeenCalledWith(["dplyr", "ggplot2"])
  })

  it("injectData evaluates data.frame code", async () => {
    const { client } = makeClient()
    await client.init()
    await client.injectData(smallDataset)
    expect(fake.webR.evalR).toHaveBeenCalledTimes(1)
    const code = fake.webR.evalR.mock.calls[0][0] as string
    expect(code).toContain("df <- data.frame(")
    expect(code).toContain("sales = c(1, 2)")
  })

  it("injectData warns for large datasets (reserved bind path)", async () => {
    const { client } = makeClient()
    await client.init()
    const large: SemanticDataset = {
      ...smallDataset,
      rows: Array.from({ length: Math.ceil(INJECT_CELL_THRESHOLD / smallDataset.columns.length) + 1 }, (_, i) => ({
        sales: i,
        region: "A",
      })),
    }
    await client.injectData(large)
    expect(client.getState().output.some((o) => o.type === "warning")).toBe(true)
  })

  it("interrupt calls webR.interrupt", async () => {
    const { client } = makeClient()
    await client.init()
    await client.interrupt()
    expect(fake.webR.interrupt).toHaveBeenCalledTimes(1)
  })

  it("clearOutput empties output and images", async () => {
    const { client } = makeClient()
    await client.init()
    await client.execute("1")
    client.clearOutput()
    expect(client.getState().output).toHaveLength(0)
    expect(client.getState().images).toHaveLength(0)
  })

  it("destroy resets state and allows re-init", async () => {
    const { client } = makeClient()
    await client.init()
    await client.execute("x")
    client.destroy()
    expect(client.getState().status).toBe("idle")
    expect(client.getState().output).toHaveLength(0)
  })

  it("notifies subscribers on state changes", async () => {
    const { client } = makeClient()
    const listener = vi.fn()
    client.subscribe(listener)
    await client.init()
    expect(listener).toHaveBeenCalled()
  })
})

describe("safeOutputData", () => {
  it("passes strings through", async () => {
    await expect(safeOutputData("hello")).resolves.toBe("hello")
  })

  it("resolves RObject-like values via toJs", async () => {
    const robject = { toJs: async () => 42 }
    await expect(safeOutputData(robject)).resolves.toBe("42")
    const robjectStr = { toJs: async () => "printed" }
    await expect(safeOutputData(robjectStr)).resolves.toBe("printed")
  })

  it("falls back to JSON for plain objects", async () => {
    await expect(safeOutputData({ a: 1 })).resolves.toBe('{"a":1}')
  })

  it("never throws for unstringifiable values", async () => {
    const cyc: Record<string, unknown> = {}
    cyc.self = cyc
    // JSON.stringify 抛错 → String() 兜底为 "[object Object]"
    await expect(safeOutputData(cyc)).resolves.toBe("[object Object]")
  })
})

describe("withTimeout", () => {
  it("resolves when promise finishes in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42)
  })

  it("rejects with timeout error when promise is slow", async () => {
    const slow = new Promise<number>((resolve) => setTimeout(() => resolve(1), 500))
    await expect(withTimeout(slow, 10)).rejects.toThrow("执行超时")
  })
})

describe("WebRClient.isLargeDataset", () => {
  it("flags datasets over the cell threshold", () => {
    const large: SemanticDataset = {
      ...smallDataset,
      rows: Array.from({ length: 60_000 }, (_, i) => ({ sales: i, region: "A" })),
    }
    expect(WebRClient.isLargeDataset(smallDataset)).toBe(false)
    expect(WebRClient.isLargeDataset(large)).toBe(true)
  })
})