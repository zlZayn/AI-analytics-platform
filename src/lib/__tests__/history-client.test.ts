import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApiResponse } from "@/types"
import type { AiHistoryEntry, HistoryEntry, RHistoryEntry } from "@/types/history"

vi.mock("@/lib/client-api", () => ({ fetchApi: vi.fn() }))

import { fetchApi } from "@/lib/client-api"
import { appendHistory, importLegacyLocalHistory, listHistory, listRHistory, toPersistedOutput } from "../history-client"

const fetchMock = vi.mocked(fetchApi)

const aiEntry: AiHistoryEntry = {
  id: "ai-1",
  connectionId: "c1",
  sessionId: "s1",
  createdAt: "2026-09-11T09:00:00.000Z",
  kind: "ai",
  question: "按区域统计",
  ok: true,
  summary: "华东最高",
  items: [],
}

const rEntry: RHistoryEntry = {
  id: "r-1",
  connectionId: "c1",
  sessionId: "s1",
  createdAt: "2026-09-11T09:00:01.000Z",
  kind: "r",
  code: "summary(df)",
  output: ["[stdout] ok"],
  imageCount: 1,
  ok: true,
}

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, requestId: "test" }
}

describe("history-client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    fetchMock.mockResolvedValue(ok([]))
  })

  it("按连接（可选 kind）读取服务端历史", async () => {
    fetchMock.mockResolvedValueOnce(ok([aiEntry, rEntry]))

    await expect(listHistory("c1")).resolves.toEqual([aiEntry, rEntry])
    expect(fetchMock).toHaveBeenCalledWith("/api/history?connectionId=c1")

    await listHistory("c1", "r")
    expect(fetchMock).toHaveBeenLastCalledWith("/api/history?connectionId=c1&kind=r")
  })

  it("空连接不发请求；服务失败退化为空数组", async () => {
    await expect(listHistory("")).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockRejectedValueOnce(new Error("boom"))
    await expect(listHistory("c1")).resolves.toEqual([])
  })

  it("listRHistory 只留 R 条目", async () => {
    fetchMock.mockResolvedValueOnce(ok<HistoryEntry[]>([aiEntry, rEntry]))

    await expect(listRHistory("c1")).resolves.toEqual([rEntry])
  })

  it("落库走 POST JSON，失败不抛（历史不阻断分析）", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"))

    expect(() => appendHistory({ kind: "r", connectionId: "c1", sessionId: "s1", code: "plot(df)", output: [], ok: true })).not.toThrow()
    await Promise.resolve()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/history")
    expect(init?.method).toBe("POST")
    expect(JSON.parse(String(init?.body))).toMatchObject({ kind: "r", connectionId: "c1", code: "plot(df)" })
  })

  it("旧浏览器记录一次性导入后删除本地键", async () => {
    window.localStorage.setItem("analytics-history:v2:c1", JSON.stringify({ version: 2, entries: [aiEntry, rEntry, { kind: "r" }] }))

    await importLegacyLocalHistory("c1")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
    expect(bodies[0]).toMatchObject({ kind: "ai", question: "按区域统计", createdAt: aiEntry.createdAt })
    expect(bodies[1]).toMatchObject({ kind: "r", code: "summary(df)", imageCount: 1, createdAt: rEntry.createdAt })
    expect(window.localStorage.getItem("analytics-history:v2:c1")).toBeNull()
  })

  it("导入失败保留本地键，下次再试；无本地记录时不发请求", async () => {
    window.localStorage.setItem("analytics-history:v2:c1", JSON.stringify({ version: 2, entries: [rEntry] }))
    fetchMock.mockRejectedValueOnce(new Error("offline"))

    await importLegacyLocalHistory("c1")
    expect(window.localStorage.getItem("analytics-history:v2:c1")).not.toBeNull()

    window.localStorage.removeItem("analytics-history:v2:c1")
    fetchMock.mockClear()
    await importLegacyLocalHistory("c1")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("文本输出截断为可持久化行，无输出落空数组", () => {
    const lines = toPersistedOutput([{ type: "stdout", data: "a\nb" }, { type: "error", data: "oops" }])

    expect(lines.join("\n")).toContain("[stdout] a")
    expect(lines.join("\n")).toContain("[error] oops")
    expect(toPersistedOutput([])).toEqual([])
  })
})
