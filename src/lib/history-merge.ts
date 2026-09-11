// 历史时间线合并（纯逻辑）
//
// 把两个来源的历史合成一条按时间倒序的统一时间线，供查询管理页「历史」标签展示：
// - 来源 A：后端 QueryHistory（SQL 执行历史，权威源，跨会话持久）
// - 来源 B：前端 history-store（AI 提问 + R 执行，会话级 sessionStorage）
// 两个来源各存各的，本模块只做读取期的合并与归一，绝不双写。
// 合并键：createdAt（ISO 字符串）倒序；同刻按来源稳定排序（SQL 在前）。

import type { HistoryEntry } from "@/lib/history-store"
import type { QueryHistoryItem } from "@/types"

/** 时间线条目：统一展示模型，kind 区分来源与动作 */
export interface TimelineItem {
  /** 列表 key：来源前缀 + 原始 id，避免两来源 id 撞车 */
  key: string
  /** 原始 id（R 条目回放时经 URL 带回工作台，按 id 从 history-store 取回） */
  id: string
  kind: "sql" | "ai" | "r"
  createdAt: string
  ok: boolean
  /** 主标题：SQL 摘要 / 问题 / R 代码摘要 */
  title: string
  /** 正文代码块：SQL 语句 / R 代码；AI 无代码块 */
  code: string
  /** 代码块之外的补充说明（AI 结论摘要） */
  note?: string
  /** 复制动作的完整文本（AI = 原始问题；SQL/R = 代码原文），空 = 不提供复制 */
  copyText: string
  /** SQL 专属：行数与耗时 */
  rowCount?: number
  executionTimeMs?: number
  /** 可在打开时带回工作台执行的 SQL；null = 只可复制。R 条目仅在有来源 SQL 时非空 */
  openSql: string | null
}

/** 标题摘要：压掉换行与多余空白，截断到 max 字符 */
function summarize(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

function fromSql(item: QueryHistoryItem): TimelineItem {
  return {
    key: `sql:${item.id}`,
    id: item.id,
    kind: "sql",
    createdAt: item.createdAt,
    ok: item.status === "success",
    title: summarize(item.sql),
    code: item.sql,
    copyText: item.sql,
    rowCount: item.rowCount,
    executionTimeMs: item.executionTimeMs,
    openSql: item.sql,
  }
}

function fromEntry(entry: HistoryEntry): TimelineItem {
  if (entry.kind === "ai") {
    return {
      key: `ai:${entry.id}`,
      id: entry.id,
      kind: "ai",
      createdAt: entry.createdAt,
      ok: entry.ok,
      title: summarize(entry.question),
      code: "",
      copyText: entry.question,
      note: summarize(entry.summary),
      openSql: aiOpenableSql(entry),
    }
  }
  return {
    key: `r:${entry.id}`,
    id: entry.id,
    kind: "r",
    createdAt: entry.createdAt,
    ok: entry.ok,
    title: summarize(entry.code),
    code: entry.code,
    copyText: entry.code,
    openSql: entry.sourceSql ?? null,
  }
}

/**
 * 合并两来源为一条时间线（新的在前）。
 * createdAt 非法（无法解析为时间）的条目排在末尾，不丢弃。
 */
export function mergeHistoryTimeline(sqlItems: QueryHistoryItem[], entries: HistoryEntry[]): TimelineItem[] {
  const merged = [...sqlItems.map(fromSql), ...entries.map(fromEntry)]
  return merged.sort((a, b) => {
    const ta = Date.parse(a.createdAt)
    const tb = Date.parse(b.createdAt)
    const va = Number.isNaN(ta)
    const vb = Number.isNaN(tb)
    if (va && vb) return 0
    if (va) return 1
    if (vb) return -1
    if (tb !== ta) return tb - ta
    // 同刻稳定：SQL 在前（后端权威源优先）
    return kindRank(a.kind) - kindRank(b.kind)
  })
}

function kindRank(kind: TimelineItem["kind"]): number {
  return kind === "sql" ? 0 : kind === "ai" ? 1 : 2
}

/** 按搜索词过滤：匹配标题或正文代码（大小写不敏感） */
export function filterTimeline(items: TimelineItem[], query: string): TimelineItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter(
    (item) => item.title.toLowerCase().includes(needle) || item.code.toLowerCase().includes(needle),
  )
}

/**
 * 取一条 AI 历史里第一条可执行洞察的 SQL（用于「打开」动作带回工作台）。
 * 优先 querySpec 编译产物不可得（合并层不编译），故只在存在有效回退 SQL 时返回；
 * 否则返回 null，界面据此隐藏「打开」只留「复制问题」。
 */
export function aiOpenableSql(entry: Extract<HistoryEntry, { kind: "ai" }>): string | null {
  for (const item of entry.items) {
    if (item.sql && item.sqlValid) return item.sql
  }
  return null
}
