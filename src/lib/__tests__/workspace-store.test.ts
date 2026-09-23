import { beforeEach, describe, expect, it } from "vitest"
import { createInitialSession } from "@/hooks/sessionReducer"
import type { InsightItem } from "@/lib/ai-contract"
import type { SemanticDataset } from "@/types/session"
import {
  WORKSPACE_STORE_VERSION,
  clearWorkspace,
  loadWorkspace,
  saveWorkspace,
  workspaceStoreKey,
} from "../workspace-store"

const CONNECTION = "conn-1"

function dataset(): SemanticDataset {
  return {
    columns: [{ name: "total", type: "int4", semanticType: "numeric" }],
    rows: [{ total: 1 }],
    rowCount: 1,
    returnedRowCount: 1,
    truncated: false,
    rowLimit: 5000,
    executionTimeMs: 1,
  }
}

function insight(): InsightItem {
  return { title: "各区域销售额", insight: "华东最高", chart: { chartType: "bar" }, fallback: false }
}

function sessionWith(patch: Parameters<typeof createInitialSession>[0] = {}) {
  return createInitialSession({ compiledSql: { sql: "SELECT 1 AS total", params: [] }, ...patch })
}

describe("workspace-store", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("按连接保存并恢复会话骨架与洞察流", () => {
    const session = sessionWith({
      title: "各区域销售额",
      question: "按区域统计",
      result: dataset(),
      conversationHistory: [
        { role: "user", content: "按区域统计", createdAt: new Date("2026-01-01T00:00:00Z") },
        { role: "assistant", content: "华东最高", createdAt: new Date("2026-01-01T00:00:01Z") },
      ],
    })

    saveWorkspace(CONNECTION, { session, insights: [insight()] })
    const restored = loadWorkspace(CONNECTION)

    expect(restored?.session.title).toBe("各区域销售额")
    expect(restored?.session.compiledSql).toBeNull()
    expect(restored?.session.querySpec).toEqual({ table: "" })
    expect(restored?.lastSql).toBe("SELECT 1 AS total")
    expect(restored?.insights).toHaveLength(1)
    expect(restored?.session.conversationHistory[0]?.createdAt).toBeInstanceOf(Date)
  })

  it("恢复不带执行物：compiledSql/querySpec 归零，避免一进工作台就自动重跑", () => {
    const session = createInitialSession({
      compiledSql: { sql: "SELECT 1", params: [] },
      querySpec: { table: "orders", measures: [{ field: "amount", aggregation: "sum", alias: "total" }] },
    })

    saveWorkspace(CONNECTION, { session, insights: [] })
    const restored = loadWorkspace(CONNECTION)

    expect(restored?.session.compiledSql).toBeNull()
    expect(restored?.session.querySpec?.table).toBe("")
    expect(restored?.lastSql).toBe("SELECT 1")
  })

  it("不持久化结果行：恢复后 result 为空，需重跑一次", () => {
    saveWorkspace(CONNECTION, { session: sessionWith({ result: dataset() }), insights: [] })

    expect(loadWorkspace(CONNECTION)?.session.result).toBeNull()
  })

  it("瞬态状态归位：compiling/executing 恢复为 ready，避免回来还在转圈", () => {
    saveWorkspace(CONNECTION, { session: sessionWith({ status: "executing" }), insights: [] })

    expect(loadWorkspace(CONNECTION)?.session.status).toBe("ready")
  })

  it("版本不符、结构损坏、无记录一律返回 null", () => {
    window.sessionStorage.setItem(workspaceStoreKey(CONNECTION), JSON.stringify({ version: WORKSPACE_STORE_VERSION - 1, session: {}, insights: [] }))
    expect(loadWorkspace(CONNECTION)).toBeNull()

    window.sessionStorage.setItem(workspaceStoreKey(CONNECTION), "{not json}")
    expect(loadWorkspace(CONNECTION)).toBeNull()

    window.sessionStorage.removeItem(workspaceStoreKey(CONNECTION))
    expect(loadWorkspace(CONNECTION)).toBeNull()
  })

  it("按连接隔离，clearWorkspace 只清自己的键", () => {
    saveWorkspace(CONNECTION, { session: sessionWith(), insights: [] })
    saveWorkspace("conn-2", { session: sessionWith({ title: "另一个连接" }), insights: [] })

    expect(loadWorkspace("conn-3")).toBeNull()

    clearWorkspace(CONNECTION)
    expect(loadWorkspace(CONNECTION)).toBeNull()
    expect(loadWorkspace("conn-2")?.session.title).toBe("另一个连接")
  })
})
