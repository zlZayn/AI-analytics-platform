// AI 结果 → 会话 action 的单一映射（纯模块）
//
// 一次提问 → 1..6 条洞察，每条洞察进入会话的方式只有这两条路径：
// 1) querySpec + displayConfig → INIT_FROM_AI 交给编译管线；
// 2) AI 只给了 sql（回退变体）→ 额外 SET_COMPILED_SQL 直通执行。
// UI 编排（useAiAssistant）与卡片执行都走这里，避免两处各写一遍。
// 契约见 [docs/ai-integration.md](../../docs/ai-integration.md)。

import type { InsightItem } from "@/lib/ai-contract"
import type { InitFromAiPayload } from "@/types/actions"
import type { CompiledSql } from "@/types/session"

/** 洞察项 → INIT_FROM_AI 载荷；querySpec 缺失时留空占位，交由回退 SQL 路径接管 */
export function buildInitFromAi(item: InsightItem, question: string): InitFromAiPayload {
  return {
    question,
    title: item.title,
    insight: item.insight,
    querySpec: item.querySpec ?? { table: "" },
    displayConfig: item.displayConfig ?? { chartType: item.chart.chartType, mapping: item.chart },
  }
}

/** 回退路径需要的 SQL：只在 AI 未给出可用 querySpec 时返回 */
export function fallbackSqlOf(item: InsightItem): CompiledSql | null {
  if (item.querySpec && !item.fallback) return null
  return item.sql ? { sql: item.sql, params: [] } : null
}

/** 请求失败 → 对话提示与是否属于「未配置」（未配置时前端另显示 .env 指引） */
export function describeAskFailure(error: unknown): { message: string; notConfigured: boolean } {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined
  return {
    message: error instanceof Error && error.message ? error.message : "请求失败",
    notConfigured: code === "AI_NOT_CONFIGURED",
  }
}
