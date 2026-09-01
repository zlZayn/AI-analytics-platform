// SessionAction 联合类型（阶段一）
// 用户任何操作都归结为对 AnalysisSession 的一次状态转换。

import type { Dispatch } from "react"

import type {
  AnalysisSession,
  CompiledSql,
  ConversationMessage,
  DisplayConfig,
  QuerySpec,
  SemanticDataset,
  SessionStatus,
} from "./session"
import type { ChartType } from "@/lib/variable-types"

/** INIT_FROM_AI 的载荷：AI 首次返回时初始化整个会话 */
export interface InitFromAiPayload {
  question: string
  title?: string
  insight?: string
  querySpec: QuerySpec
  displayConfig: DisplayConfig
  conversationHistory?: ConversationMessage[]
}

export type SessionAction =
  | { type: "ASK_AI"; question: string }
  | { type: "COMPILE_START" }
  | { type: "SET_COMPILED_SQL"; compiledSql: CompiledSql }
  | { type: "COMPILE_ERROR"; error: string }
  | { type: "EXECUTE_START" }
  | { type: "EXECUTE_SUCCESS"; result: SemanticDataset }
  | { type: "EXECUTE_ERROR"; error: string }
  | { type: "INIT_FROM_AI"; payload: InitFromAiPayload }
  | { type: "UPDATE_QUERY_SPEC"; querySpec: QuerySpec }
  | { type: "UPDATE_DISPLAY_CONFIG"; displayConfig: DisplayConfig }
  | { type: "CHANGE_CHART_TYPE"; chartType: ChartType }
  | { type: "UPDATE_TITLE"; title: string }
  | { type: "UPDATE_INSIGHT"; insight: string }
  | { type: "SET_STATUS"; status: SessionStatus }
  | { type: "MARK_USER_MODIFIED" }
  | { type: "CLEAR_ERROR" }
  | { type: "ADD_CONVERSATION"; message: ConversationMessage }
  | { type: "SET_QUESTION"; question: string }
  | { type: "RESET"; payload?: Partial<AnalysisSession> }

export type SessionDispatch = Dispatch<SessionAction>
