import { beforeEach, describe, expect, it } from "vitest"
import { HISTORY_STORE_VERSION, appendHistory, clearHistory, historyKey, latestRHistory, listHistory, toPersistedOutput } from "../history-store"

describe("统一历史记录", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("提问与 R 执行都落库，最新在前", () => {
    appendHistory({ kind: "ai", connectionId: "s1", question: "按区域统计", ok: true, summary: "华东最高", items: [] })
    appendHistory({ kind: "r", connectionId: "s1", code: "summary(df)", output: ["[stdout] ok"], ok: true })

    const entries = listHistory("s1")
    expect(entries.map((entry) => entry.kind)).toEqual(["r", "ai"])
    expect(latestRHistory("s1")?.code).toBe("summary(df)")
  })

  it("带版本号与作用域隔离", () => {
    appendHistory({ kind: "r", connectionId: "s1", code: "df", output: [], ok: true })

    expect(window.sessionStorage.getItem(historyKey("s1"))).toContain(`"version":${HISTORY_STORE_VERSION}`)
    expect(listHistory("s2")).toEqual([])
  })

  it("损坏或结构不符的记录一律忽略", () => {
    window.sessionStorage.setItem(historyKey("s1"), "{not json}")
    expect(listHistory("s1")).toEqual([])

    window.sessionStorage.setItem(historyKey("s1"), JSON.stringify({ version: HISTORY_STORE_VERSION, entries: [{ kind: "r" }] }))
    expect(listHistory("s1")).toEqual([])
  })

  it("文本输出截断为可持久化行", () => {
    const lines = toPersistedOutput([{ type: "stdout", data: "a\nb" }, { type: "error", data: "oops" }])

    expect(lines.join("\n")).toContain("[stdout] a")
    expect(lines.join("\n")).toContain("[error] oops")
  })

  it("clearHistory 清空该作用域", () => {
    appendHistory({ kind: "ai", connectionId: "s1", question: "q", ok: true, summary: "s", items: [] })
    clearHistory("s1")
    expect(listHistory("s1")).toEqual([])
  })
})
