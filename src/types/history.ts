// 统一历史记录契约（AI 提问 + R 执行）：服务端 analysis_history 表 ↔ 前端时间线。
//
// SQL 执行历史的权威源是后端 query_history 表（见 api/query/history）；
// 两类来源各存各的，读取期由 lib/history-merge.ts 纯函数合并，绝不双写。

import type { InsightItem } from "@/lib/ai-contract"

export type HistoryKind = "ai" | "r"

interface HistoryBase {
  id: string
  /** 作用域键：数据库连接 id（与后端 SQL 历史同轴） */
  connectionId: string
  /** 产生记录的会话 id（溯源用，不参与作用域键） */
  sessionId: string
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
  /** 执行时结果集来源的 SQL（回放时带回工作台重跑 df）；无结果集时缺省 */
  sourceSql?: string
  /** 文本输出（stdout/error/warning 合并，已截断）；图片不持久化 */
  output: string[]
  /** 本次执行产出的图片张数（图片不持久化，回放靠重跑重绘） */
  imageCount?: number
  ok: boolean
}

export type HistoryEntry = AiHistoryEntry | RHistoryEntry

/**
 * 追加记录（POST /api/history）：id 由服务端生成；
 * createdAt 缺省 = 服务端当前时间，仅"导入旧浏览器记录"时透传原时间。
 */
export type NewHistoryEntry =
  | (Omit<AiHistoryEntry, "id" | "createdAt"> & { createdAt?: string })
  | (Omit<RHistoryEntry, "id" | "createdAt"> & { createdAt?: string })
