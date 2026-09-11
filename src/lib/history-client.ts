// 统一历史记录（AI 提问 + R 执行）客户端
//
// 权威源是服务端元库 `analysis_history` 表（见 api/history）：浏览器不落副本，读取即一处真相。
// 与 SQL 历史（query_history）同轴，查询管理页按 connectionId 合并成一条时间线。
// 取不到数据时退化为"没有历史"，绝不阻断分析主流程。
//
// 与 workspace-store 的分工：
// - workspace-store 存**当前状态**（会话骨架 + 洞察流，用于"接着用"，留在浏览器）
// - 本模块读写**发生过什么**（历史记录，用于"回看/复用"）

import { fetchApi } from "@/lib/client-api"
import type { ApiResponse } from "@/types"
import type { HistoryEntry, HistoryKind, NewHistoryEntry, RHistoryEntry } from "@/types/history"

const R_OUTPUT_MAX_LINES = 40
const R_OUTPUT_MAX_CHARS = 4000

/** R 文本输出 → 可持久化的行数组（截断，避免单条记录过大；无文本输出 = 空数组，不落空行） */
export function toPersistedOutput(items: { type: string; data: string }[]): string[] {
  if (items.length === 0) return []
  return items
    .map((item) => `[${item.type}] ${item.data}`)
    .slice(-R_OUTPUT_MAX_LINES)
    .join("\n")
    .slice(-R_OUTPUT_MAX_CHARS)
    .split("\n")
}

/** 读取历史（新的在前）；服务不可用时返回空数组（时间线只显示 SQL 历史） */
export async function listHistory(connectionId: string, kind?: HistoryKind): Promise<HistoryEntry[]> {
  if (!connectionId) return []
  const params = new URLSearchParams({ connectionId })
  if (kind) params.set("kind", kind)
  try {
    const response = await fetchApi<ApiResponse<HistoryEntry[]>>(`/api/history?${params.toString()}`)
    return response.success ? response.data : []
  } catch (error) {
    console.warn("读取历史记录失败", error instanceof Error ? error.message : error)
    return []
  }
}

/** 只读取 R 历史：R 工作台的回放取代码与"恢复上次代码"共用一次请求 */
export async function listRHistory(connectionId: string): Promise<RHistoryEntry[]> {
  const entries = await listHistory(connectionId, "r")
  return entries.filter((entry): entry is RHistoryEntry => entry.kind === "r")
}

/** 落一条历史：失败只写日志、不抛（历史不得阻断分析主流程） */
export function appendHistory(entry: NewHistoryEntry): void {
  void postHistory(entry).catch((error) => {
    console.warn("保存历史记录失败", error instanceof Error ? error.message : error)
  })
}

async function postHistory(entry: NewHistoryEntry): Promise<HistoryEntry | null> {
  const response = await fetchApi<ApiResponse<HistoryEntry>>("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  })
  return response.success ? response.data : null
}

// ---------- 旧浏览器记录一次性导入 ----------

/** v2 时期的历史键（localStorage）：只读一次用于导入，之后不再写第二份 */
const LEGACY_KEY_PREFIX = "analytics-history:v2:"

/**
 * 把浏览器里遗留的 AI/R 历史搬进服务端（搬完删除本地键，不再保留第二份）。
 * 导入失败保留本地键，下次进入页面重试；多标签并发首屏可能导入重复条目。
 */
export async function importLegacyLocalHistory(connectionId: string): Promise<void> {
  if (!connectionId || typeof window === "undefined") return
  const key = `${LEGACY_KEY_PREFIX}${connectionId}`
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return
  }
  if (!raw) return

  const entries = parseLegacyEntries(raw)
  try {
    for (const entry of entries) {
      await postHistory(entry)
    }
  } catch {
    // 保留本地键：下次进入页面再试
    return
  }
  try {
    window.localStorage.removeItem(key)
  } catch {
    // 与读取一致：静默降级
  }
}

/** 旧记录 → 追加入参（id 由服务端重新分配，createdAt 透传以保住时间线顺序） */
function parseLegacyEntries(raw: string): NewHistoryEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  const entries = (parsed as { entries?: unknown } | null)?.entries
  if (!Array.isArray(entries)) return []
  return entries.filter(isLegacyEntry).map(toNewEntry)
}

function toNewEntry(entry: HistoryEntry): NewHistoryEntry {
  if (entry.kind === "ai") {
    return {
      kind: "ai",
      connectionId: entry.connectionId,
      sessionId: entry.sessionId,
      question: entry.question,
      summary: entry.summary,
      ok: entry.ok,
      items: entry.items,
      createdAt: entry.createdAt,
    }
  }
  return {
    kind: "r",
    connectionId: entry.connectionId,
    sessionId: entry.sessionId,
    code: entry.code,
    sourceSql: entry.sourceSql,
    output: entry.output,
    imageCount: entry.imageCount,
    ok: entry.ok,
    createdAt: entry.createdAt,
  }
}

function isLegacyEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<HistoryEntry> & { kind?: unknown }
  if (typeof entry.connectionId !== "string" || typeof entry.sessionId !== "string") return false
  if (typeof entry.createdAt !== "string" || typeof entry.id !== "string") return false
  if (entry.kind === "ai") return typeof (entry as { question?: unknown }).question === "string" && Array.isArray((entry as { items?: unknown }).items)
  if (entry.kind === "r") return typeof (entry as { code?: unknown }).code === "string" && Array.isArray((entry as { output?: unknown }).output)
  return false
}
