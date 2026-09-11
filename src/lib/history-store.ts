// 统一历史记录（AI 会话 + R 执行）
//
// 一份命名空间、一个版本号、统一上限：每次提问与每次 R 执行都自动落一条，可回看与复用。
// 与 workspace-store 的分工：
// - workspace-store 存**当前状态**（会话骨架 + 洞察流，用于"接着用"）
// - 本模块存**发生过什么**（历史记录，用于"回看/复用"）
// 两者都只存文本，不存图片与查询结果行。
//
// 作用域键 = connectionId（v2 起）：与后端 QueryHistory（SQL 执行历史）同轴，
// 查询管理页才能把两类来源合并成一条时间线；sessionId 仅做溯源，不参与键。
// SQL 执行历史不在此双写——它的权威源是后端表（见 lib/history-merge.ts 的合并契约）。

import type { InsightItem } from "@/lib/ai-contract"

export const HISTORY_STORE_VERSION = 2
/** 每个作用域保留的条数上限（新的在前） */
const HISTORY_LIMIT = 50
const R_OUTPUT_MAX_LINES = 40
const R_OUTPUT_MAX_CHARS = 4000

export type HistoryKind = "ai" | "r"

interface HistoryBase {
  id: string
  /** 作用域键：数据库连接 id（v2 起；v1 误用会话 id，旧 sessionStorage 键直接放弃） */
  connectionId: string
  createdAt: string
}

export interface AiHistoryEntry extends HistoryBase {
  kind: "ai"
  /** 产生记录的会话 id（溯源用，不参与作用域键） */
  sessionId: string
  question: string
  ok: boolean
  /** 一句话摘要（首条洞察的结论或失败原因） */
  summary: string
  items: InsightItem[]
}

export interface RHistoryEntry extends HistoryBase {
  kind: "r"
  /** 产生记录的会话 id（溯源用，不参与作用域键） */
  sessionId: string
  code: string
  /** 执行时结果集来源的 SQL（回放时带回工作台重跑 df）；无结果集时缺省 */
  sourceSql?: string
  /** 文本输出（stdout/error/warning 合并，已截断）；图片不持久化 */
  output: string[]
  ok: boolean
}

export type HistoryEntry = AiHistoryEntry | RHistoryEntry

export function historyKey(connectionId: string): string {
  return `analytics-history:v${HISTORY_STORE_VERSION}:${connectionId}`
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function listHistory(connectionId: string): HistoryEntry[] {
  const store = storage()
  if (!store) return []
  try {
    const raw = store.getItem(historyKey(connectionId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return []
    const entries = (parsed as { entries?: unknown }).entries
    if (!Array.isArray(entries)) return []
    return entries.filter(isHistoryEntry)
  } catch {
    return []
  }
}

export function listHistoryByKind<K extends HistoryKind>(connectionId: string, kind: K): Extract<HistoryEntry, { kind: K }>[] {
  return listHistory(connectionId).filter((entry): entry is Extract<HistoryEntry, { kind: K }> => entry.kind === kind)
}

export function latestRHistory(connectionId: string): RHistoryEntry | null {
  return listHistoryByKind(connectionId, "r")[0] ?? null
}

/** 按 id 取一条 R 历史（历史面板「在工作台回放」用；id 不存在或类型不符返回 null） */
export function rHistoryById(connectionId: string, id: string): RHistoryEntry | null {
  return listHistoryByKind(connectionId, "r").find((entry) => entry.id === id) ?? null
}

export function appendHistory(entry: Omit<AiHistoryEntry, "id" | "createdAt"> | Omit<RHistoryEntry, "id" | "createdAt">): void {
  const store = storage()
  if (!store) return
  const record: HistoryEntry = {
    ...entry,
    id: `${entry.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  }
  const next = [record, ...listHistory(entry.connectionId)].slice(0, HISTORY_LIMIT)
  try {
    store.setItem(historyKey(entry.connectionId), JSON.stringify({ version: HISTORY_STORE_VERSION, entries: next }))
  } catch {
    // 存储不可用/超限：历史功能静默降级，不影响分析主流程
  }
}

/** R 文本输出 → 可持久化的行数组（截断，避免单条记录过大） */
export function toPersistedOutput(items: { type: string; data: string }[]): string[] {
  return items
    .map((item) => `[${item.type}] ${item.data}`)
    .slice(-R_OUTPUT_MAX_LINES)
    .join("\n")
    .slice(-R_OUTPUT_MAX_CHARS)
    .split("\n")
}

export function clearHistory(connectionId: string): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(historyKey(connectionId))
  } catch {
    // 同 appendHistory：静默降级
  }
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<HistoryEntry> & { kind?: unknown }
  if (typeof entry.connectionId !== "string" || typeof entry.sessionId !== "string") return false
  if (entry.kind === "ai") return typeof entry.question === "string" && Array.isArray((entry as AiHistoryEntry).items)
  if (entry.kind === "r") return typeof (entry as RHistoryEntry).code === "string" && Array.isArray((entry as RHistoryEntry).output)
  return false
}
