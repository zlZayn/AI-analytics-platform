// 会话状态 reducer（阶段二）
// 纯函数：任何用户操作都归结为对 AnalysisSession 的一次状态转换。
// 通过 createSessionReducer(schema) 闭包注入 SchemaData，供 schema-based 校验使用。

import type { AnalysisSession, ConversationMessage } from "@/types/session"
import type { InitFromAiPayload, SessionAction } from "@/types/actions"
import type { SchemaData } from "@/types"
import type { ChartMapping } from "@/components/charts/types"
import { createChartMapping, getMappingSlot } from "@/components/charts/mapping"
import { validateDisplayConfig } from "@/lib/validators"

export interface SessionReducerDeps {
  schema: SchemaData | null
}

export function createInitialSession(overrides?: Partial<AnalysisSession>): AnalysisSession {
  const now = new Date()
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `session-${Date.now()}`,
    question: "",
    title: "",
    insight: "",
    querySpec: { table: "" },
    compiledSql: null,
    result: null,
    displayConfig: { chartType: "table", mapping: createChartMapping("table") },
    status: "idle",
    source: "user",
    isUserModified: false,
    conversationHistory: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const MAPPING_COLUMN_SLOTS = [
  "x",
  "y",
  "color",
  "fill",
  "name",
  "value",
  "category",
  "label",
  "comparison",
] as const

/** 收集 mapping 中引用的所有字段名（含 correlation.columns） */
export function collectMappingFields(mapping: ChartMapping): string[] {
  const fields: string[] = []
  for (const slot of MAPPING_COLUMN_SLOTS) {
    const value = getMappingSlot(mapping, slot)
    if (value) fields.push(value)
  }
  if (mapping.chartType === "correlation" && Array.isArray(mapping.columns)) {
    fields.push(...mapping.columns)
  }
  return fields
}

/** 计算 mapping 中引用但在可用列中不存在的字段 */
export function missingMappingFields(mapping: ChartMapping, availableColumns: string[]): string[] {
  const available = new Set(availableColumns)
  return collectMappingFields(mapping).filter((field) => !available.has(field))
}

export function createSessionReducer(deps: SessionReducerDeps) {
  const { schema } = deps

  function currentColumns(state: AnalysisSession): string[] {
    if (state.result) return state.result.columns.map((c) => c.name)
    if (schema) return schema.tables.flatMap((t) => t.columns.map((c) => c.name))
    return []
  }

  return function sessionReducer(state: AnalysisSession, action: SessionAction): AnalysisSession {
    const touch = <T extends AnalysisSession>(next: T): T => ({ ...next, updatedAt: new Date() })

    switch (action.type) {
      case "ASK_AI": {
        const userMessage: ConversationMessage = {
          role: "user",
          content: action.question,
          createdAt: new Date(),
        }
        return touch({
          ...state,
          question: action.question,
          source: "user",
          isUserModified: false,
          error: undefined,
          conversationHistory: [...state.conversationHistory, userMessage],
        })
      }

      case "COMPILE_START":
        return touch({ ...state, status: "compiling", error: undefined })

      case "SET_COMPILED_SQL":
        return touch({ ...state, compiledSql: action.compiledSql, status: "executing", error: undefined })

      case "COMPILE_ERROR":
        return touch({ ...state, status: "error", error: action.error, compiledSql: null })

      case "EXECUTE_START":
        return touch({ ...state, status: "executing", error: undefined })

      case "EXECUTE_SUCCESS": {
        // data-based 校验：确认结果列支持当前 displayConfig（错误不阻断状态存储）
        if (schema) {
          validateDisplayConfig(state.displayConfig, { mode: "data", dataset: action.result })
        }
        return touch({ ...state, status: "ready", result: action.result, error: undefined })
      }

      case "EXECUTE_ERROR":
        return touch({ ...state, status: "error", error: action.error })

      case "INIT_FROM_AI": {
        const payload: InitFromAiPayload = action.payload
        // schema-based 校验：AI 生成的 displayConfig 必须引用真实存在的字段
        if (schema) {
          validateDisplayConfig(payload.displayConfig, { mode: "schema", schema })
        }
        return touch({
          ...state,
          question: payload.question,
          title: payload.title ?? payload.question,
          insight: payload.insight ?? "",
          querySpec: payload.querySpec,
          displayConfig: payload.displayConfig,
          compiledSql: null,
          result: null,
          status: "compiling",
          error: undefined,
          source: "ai",
          isUserModified: false,
          conversationHistory: payload.conversationHistory ?? state.conversationHistory,
        })
      }

      case "UPDATE_QUERY_SPEC":
        return touch({
          ...state,
          querySpec: action.querySpec,
          status: "needs_recompile",
          isUserModified: true,
          error: undefined,
        })

      case "UPDATE_DISPLAY_CONFIG": {
        const next: AnalysisSession = {
          ...state,
          displayConfig: action.displayConfig,
          isUserModified: true,
          error: undefined,
        }
        // 判断是否重查：mapping 引用了当前结果/Schema 中不存在的字段 → 需要重新查询
        const missing = missingMappingFields(action.displayConfig.mapping, currentColumns(state))
        if (missing.length > 0) {
          return touch({ ...next, status: "needs_recompile" })
        }
        return touch(next)
      }

      case "CHANGE_CHART_TYPE":
        // 纯展示层变更：不改查询，不触发重查（柱状图→折线图等）
        return touch({
          ...state,
          displayConfig: { ...state.displayConfig, chartType: action.chartType },
          isUserModified: true,
        })

      case "UPDATE_TITLE":
        return touch({ ...state, title: action.title })

      case "UPDATE_INSIGHT":
        return touch({ ...state, insight: action.insight })

      case "SET_STATUS":
        return touch({ ...state, status: action.status })

      case "MARK_USER_MODIFIED":
        return touch({ ...state, isUserModified: true })

      case "CLEAR_ERROR":
        return touch({ ...state, error: undefined })

      case "ADD_CONVERSATION":
        return touch({
          ...state,
          conversationHistory: [...state.conversationHistory, action.message],
        })

      case "SET_QUESTION":
        return touch({ ...state, question: action.question })

      case "RESET":
        return createInitialSession(action.payload)
    }
  }
}
