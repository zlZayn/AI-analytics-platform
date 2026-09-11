import { beforeEach, describe, expect, it } from "vitest"
import { HISTORY_STORE_VERSION, appendHistory, clearHistory, historyKey, latestRHistory, listHistory, rHistoryById, toPersistedOutput } from "../history-store"

describe("统一历史记录", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("提问与 R 执行都落库，最新在前", () => {
    appendHistory({ kind: "ai", connectionId: "c1", sessionId: "s1", question: "按区域统计", ok: true, summary: "华东最高", items: [] })
    appendHistory({ kind: "r", connectionId: "c1", sessionId: "s1", code: "summary(df)", output: ["[stdout] ok"], ok: true })

    const entries = listHistory("c1")
    expect(entries.map((entry) => entry.kind)).toEqual(["r", "ai"])
    expect(latestRHistory("c1")?.code).toBe("summary(df)")
  })

  it("带版本号与作用域隔离（作用域键 = 连接 id）", () => {
    appendHistory({ kind: "r", connectionId: "c1", sessionId: "s1", code: "df", output: [], ok: true })

    expect(window.sessionStorage.getItem(historyKey("c1"))).toContain(`"version":${HISTORY_STORE_VERSION}`)
    expect(listHistory("c2")).toEqual([])
  })

  it("同一连接不同会话共享历史，sessionId 仅做溯源", () => {
    appendHistory({ kind: "r", connectionId: "c1", sessionId: "s1", code: "a", output: [], ok: true })
    appendHistory({ kind: "r", connectionId: "c1", sessionId: "s2", code: "b", output: [], ok: true })

    const entries = listHistory("c1")
    expect(entries.map((entry) => entry.sessionId)).toEqual(["s2", "s1"])
  })

  it("R 历史携带来源 SQL，rHistoryById 按 id 精确取回", () => {
    appendHistory({ kind: "r", connectionId: "c1", sessionId: "s1", code: "plot(df)", sourceSql: "SELECT * FROM t", output: [], ok: true })
    appendHistory({ kind: "ai", connectionId: "c1", sessionId: "s1", question: "q", ok: true, summary: "s", items: [] })

    const target = listHistory("c1").find((entry) => entry.kind === "r")
    expect(target?.kind === "r" && target.sourceSql).toBe("SELECT * FROM t")
    expect(rHistoryById("c1", target!.id)?.code).toBe("plot(df)")
    expect(rHistoryById("c1", "missing")).toBeNull()
  })

  it("损坏或结构不符的记录一律忽略", () => {
    window.sessionStorage.setItem(historyKey("c1"), "{not json}")
    expect(listHistory("c1")).toEqual([])

    window.sessionStorage.setItem(historyKey("c1"), JSON.stringify({ version: HISTORY_STORE_VERSION, entries: [{ kind: "r" }] }))
    expect(listHistory("c1")).toEqual([])
  })

  it("文本输出截断为可持久化行", () => {
    const lines = toPersistedOutput([{ type: "stdout", data: "a\nb" }, { type: "error", data: "oops" }])

    expect(lines.join("\n")).toContain("[stdout] a")
    expect(lines.join("\n")).toContain("[error] oops")
  })

  it("clearHistory 清空该作用域", () => {
    appendHistory({ kind: "ai", connectionId: "c1", sessionId: "s1", question: "q", ok: true, summary: "s", items: [] })
    clearHistory("c1")
    expect(listHistory("c1")).toEqual([])
  })
})
