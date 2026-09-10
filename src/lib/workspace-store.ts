// 工作台会话持久化（按连接）
//
// 解决的问题：工作台组件按 `connection:sql` key 挂载，切页/刷新即整体丢失——
// AI 对话、洞察卡片、SQL 草稿与展示配置都会消失。这里把「会话骨架 + 洞察流」按连接存进
// sessionStorage，重新进入时恢复；**不存查询结果行**（体量大，且结果属于服务端，
// 避免本地副本被误当成权威数据）。
//
// 只看骨架：谁在存、存什么、坏了怎么办——都在这个文件里，其它模块不重复实现。

import type { InsightItem } from "@/lib/ai-contract"
import type { AnalysisSession } from "@/types/session"

export const WORKSPACE_STORE_VERSION = 1

/** 写入内容：会话骨架 + 洞察流（lastSql 由 saveWorkspace 从会话里取，调用方不用管） */
export interface WorkspaceSnapshot {
  session: AnalysisSession
  insights: InsightItem[]
}

/** 读回内容：会话骨架已归零执行物，SQL 单独给出（仅用于回填编辑器草稿） */
export interface LoadedWorkspace extends WorkspaceSnapshot {
  lastSql: string
}

/** 会话状态中的瞬态：恢复时归位，避免「回来还在转圈」 */
const TRANSIENT_STATUSES = new Set(["compiling", "executing"])

export function workspaceStoreKey(connectionId: string): string {
  return `ai-analytics:workspace:v${WORKSPACE_STORE_VERSION}:${connectionId}`
}

export function saveWorkspace(connectionId: string | null, snapshot: WorkspaceSnapshot): void {
  if (!connectionId || typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      workspaceStoreKey(connectionId),
      JSON.stringify({
        version: WORKSPACE_STORE_VERSION,
        savedAt: new Date().toISOString(),
        session: { ...snapshot.session, result: null },
        insights: snapshot.insights,
      }),
    )
  } catch {
    // 存储不可用（隐私模式 / 配额）时静默降级：工作台照常可用，只是不保留
  }
}

export function loadWorkspace(connectionId: string | null): LoadedWorkspace | null {
  if (!connectionId || typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(workspaceStoreKey(connectionId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== WORKSPACE_STORE_VERSION) return null
    const session = parsed.session
    if (!isRecord(session) || typeof session.id !== "string" || !isRecord(session.querySpec)) return null
    if (!isRecord(session.displayConfig) || !Array.isArray(session.conversationHistory)) return null

    const restored = session as unknown as AnalysisSession
    // 关键：compiledSql 与 querySpec 不入会话——两者任一非空都会触发编译/执行副作用，
    // 造成「一进工作台就重跑一次查询」。SQL 只作草稿回填，重看结果由一次显式执行完成。
    const lastSql = typeof restored.compiledSql?.sql === "string" ? restored.compiledSql.sql : ""
    return {
      lastSql,
      session: {
        ...restored,
        result: null,
        compiledSql: null,
        querySpec: { table: "" },
        status: TRANSIENT_STATUSES.has(restored.status) ? "ready" : restored.status,
        conversationHistory: restored.conversationHistory.map((message) => ({
          ...message,
          createdAt: new Date(message.createdAt),
        })),
        createdAt: new Date(restored.createdAt),
        updatedAt: new Date(restored.updatedAt),
      },
      insights: Array.isArray(parsed.insights) ? (parsed.insights as InsightItem[]) : [],
    }
  } catch {
    return null
  }
}

export function clearWorkspace(connectionId: string | null): void {
  if (!connectionId || typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(workspaceStoreKey(connectionId))
  } catch {
    // 同 saveWorkspace：存储不可用时静默降级
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
