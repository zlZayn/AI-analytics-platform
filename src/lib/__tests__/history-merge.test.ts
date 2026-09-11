import { describe, expect, it } from "vitest"
import type { HistoryEntry } from "../history-store"
import { aiOpenableSql, filterTimeline, mergeHistoryTimeline } from "../history-merge"
import type { QueryHistoryItem } from "@/types"

function sqlItem(id: string, sql: string, createdAt: string, status = "success"): QueryHistoryItem {
  return { id, sql, rowCount: 3, executionTimeMs: 5, status, errorCode: null, createdAt }
}

function aiEntry(id: string, createdAt: string, sql?: string, sqlValid = true): HistoryEntry {
  return {
    id, connectionId: "c1", sessionId: "s1", createdAt, kind: "ai",
    question: "按区域统计", ok: true, summary: "华东最高",
    items: sql ? [{ title: "t", insight: "i", sql, sqlValid, chart: { chartType: "table" }, fallback: true }] : [],
  }
}

function rEntry(id: string, createdAt: string, sourceSql?: string): HistoryEntry {
  return { id, connectionId: "c1", sessionId: "s1", createdAt, kind: "r", code: "summary(df)", sourceSql, output: [], ok: true }
}

describe("mergeHistoryTimeline", () => {
  it("两来源按时间倒序合并，新的在前", () => {
    const items = mergeHistoryTimeline(
      [sqlItem("q1", "SELECT 1", "2026-09-11T08:00:00Z")],
      [aiEntry("a1", "2026-09-11T10:00:00Z"), rEntry("r1", "2026-09-11T09:00:00Z")],
    )
    expect(items.map((i) => i.kind)).toEqual(["ai", "r", "sql"])
  })

  it("同刻稳定排序：SQL 在前（后端权威源优先）", () => {
    const at = "2026-09-11T09:00:00Z"
    const items = mergeHistoryTimeline([sqlItem("q1", "SELECT 1", at)], [rEntry("r1", at), aiEntry("a1", at)])
    expect(items.map((i) => i.kind)).toEqual(["sql", "ai", "r"])
  })

  it("createdAt 非法的条目排在末尾且不丢弃", () => {
    const items = mergeHistoryTimeline([sqlItem("q1", "SELECT 1", "not-a-date")], [rEntry("r1", "2026-09-11T09:00:00Z")])
    expect(items.map((i) => i.kind)).toEqual(["r", "sql"])
  })

  it("动作可用性：SQL 总能打开；R 仅在有来源 SQL 时；AI 仅有有效回退 SQL 时", () => {
    const items = mergeHistoryTimeline(
      [sqlItem("q1", "SELECT 1", "2026-09-11T09:00:00Z")],
      [
        rEntry("r1", "2026-09-11T09:00:01Z", "SELECT * FROM t"),
        rEntry("r2", "2026-09-11T09:00:02Z"),
        aiEntry("a1", "2026-09-11T09:00:03Z", "SELECT 2"),
        aiEntry("a2", "2026-09-11T09:00:04Z", "SELECT 3", false),
        aiEntry("a3", "2026-09-11T09:00:05Z"),
      ],
    )
    const byId = Object.fromEntries(items.map((i) => [i.id, i]))
    expect(byId["q1"].openSql).toBe("SELECT 1")
    expect(byId["r1"].openSql).toBe("SELECT * FROM t")
    expect(byId["r2"].openSql).toBeNull()
    expect(byId["a1"].openSql).toBe("SELECT 2")
    expect(byId["a2"].openSql).toBeNull()
    expect(byId["a3"].openSql).toBeNull()
  })

  it("复制文本：AI 用完整问题，SQL/R 用代码原文", () => {
    const items = mergeHistoryTimeline([sqlItem("q1", "SELECT 1", "2026-09-11T09:00:00Z")], [aiEntry("a1", "2026-09-11T09:00:01Z"), rEntry("r1", "2026-09-11T09:00:02Z")])
    const byKind = Object.fromEntries(items.map((i) => [i.kind, i]))
    expect(byKind.ai.copyText).toBe("按区域统计")
    expect(byKind.sql.copyText).toBe("SELECT 1")
    expect(byKind.r.copyText).toBe("summary(df)")
  })
})

describe("filterTimeline", () => {
  const items = mergeHistoryTimeline(
    [sqlItem("q1", "SELECT region FROM orders", "2026-09-11T09:00:00Z")],
    [aiEntry("a1", "2026-09-11T09:00:01Z"), rEntry("r1", "2026-09-11T09:00:02Z")],
  )

  it("空查询不过滤", () => {
    expect(filterTimeline(items, "  ")).toHaveLength(3)
  })

  it("匹配标题、代码与 AI 问题（大小写不敏感）", () => {
    expect(filterTimeline(items, "region").map((i) => i.kind)).toEqual(["sql"])
    expect(filterTimeline(items, "SUMMARY").map((i) => i.kind)).toEqual(["r"])
    expect(filterTimeline(items, "区域").map((i) => i.kind)).toEqual(["ai"])
  })
})

describe("aiOpenableSql", () => {
  it("只认通过只读预检的回退 SQL", () => {
    const valid = aiEntry("a1", "2026-09-11T09:00:00Z", "SELECT 1") as Extract<HistoryEntry, { kind: "ai" }>
    const invalid = aiEntry("a2", "2026-09-11T09:00:00Z", "DROP TABLE x", false) as Extract<HistoryEntry, { kind: "ai" }>
    expect(aiOpenableSql(valid)).toBe("SELECT 1")
    expect(aiOpenableSql(invalid)).toBeNull()
  })
})
