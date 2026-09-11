// 统一历史记录（AI 会话 + R 执行）
//
// 一份命名空间、一个版本号、统一上限：每次提问与每次 R 执行都自动落一条，可回看与复用。
// 与 workspace-store 的分工：
// - workspace-store 存**当前状态**（会话骨架 + 洞察流，用于"接着用"）
// - 本模块存**发生过什么**（历史记录，用于"回看/复用"）
// 两者都只存文本，不存图片与查询结果行。

import type { InsightItem } from "@/lib/ai-contract"

export const HISTORY_STORE_VERSION = 1
/** 每个作用域保留的条数上限（新的在前） */
const HISTORY_LIMIT = 50
const R_OUTPUT_MAX_LINES = 40
const R_OUTPUT_MAX_CHARS = 4000

export type HistoryKind = "ai" | "r"

interface HistoryBase {
  id: string
  connectionId: string
  createdAt: string
}

export interface AiHistoryEntry extends HistoryBase {
  kind: "ai"
  question: string
  ok: boolean
  /** 一句话摘要（首条洞察的结论或失败原因） */
  summary: string
  items: InsightItem[]
}

export interface RHistoryEntry extends HistoryBase {
  kind: "r"
  code: string
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
  if (entry.kind === "ai") return typeof entry.question === "string" && Array.isArray((entry as AiHistoryEntry).items)
  if (entry.kind === "r") return typeof (entry as RHistoryEntry).code === "string" && Array.isArray((entry as RHistoryEntry).output)
  return false
}
