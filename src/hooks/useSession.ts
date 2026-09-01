"use client"

// 会话状态接入（阶段二）
// useReducer + sessionReducer，配合三个 useEffect 副作用：
// 1. querySpec 变化 → 编译（compileQuerySpec）
// 2. compiledSql 变化 → 执行（executeCompiled，由调用方注入，解耦 API 细节）
// 3. status=needs_recompile → 判断重查（querySpec 未变时仅展示层变更，回到 ready）
//
// connectionId 与 schema 作为参数传入；schema 通过 ref 提供最新值，
// 避免 schema 异步到达时对已编译结果造成重复执行。

import { useEffect, useMemo, useReducer, useRef } from "react"
import type { AnalysisSession, CompiledSql, SemanticDataset } from "@/types/session"
import type { SessionDispatch } from "@/types/actions"
import type { SchemaData } from "@/types"
import { createInitialSession, createSessionReducer } from "./sessionReducer"
import { compileQuerySpec } from "@/lib/query-compiler"

export interface UseSessionOptions {
  connectionId: string | null
  schema: SchemaData | null
  /** 执行编译后的 SQL，返回语义数据集（调用方负责与后端 API 对接） */
  executeCompiled: (compiledSql: CompiledSql, connectionId: string) => Promise<SemanticDataset>
  initialSession?: Partial<AnalysisSession>
  /** 是否自动编译并执行（feature flag，默认 true；关闭后仅管理状态，由调用方手动 dispatch） */
  autoRun?: boolean
}

export interface UseSessionResult {
  session: AnalysisSession
  dispatch: SessionDispatch
}

export function useSession(options: UseSessionOptions): UseSessionResult {
  const { connectionId, schema, executeCompiled, initialSession, autoRun = true } = options

  const reducer = useMemo(() => createSessionReducer({ schema }), [schema])
  const [state, dispatch] = useReducer(reducer, initialSession ?? {}, (s) => createInitialSession(s))

  // 最新值 ref：副作用内部读取，不参与依赖比较。
  // 不能在渲染期更新 ref（react-hooks/refs），统一在无依赖的 effect 中同步；
  // 这些同步 effect 声明在依赖它们的副作用之前，保证同一次提交中先更新、后读取。
  const schemaRef = useRef(schema)
  const executeRef = useRef(executeCompiled)
  const connectionIdRef = useRef(connectionId)
  const compiledSpecRef = useRef<string | null>(null)

  useEffect(() => {
    schemaRef.current = schema
  })
  useEffect(() => {
    executeRef.current = executeCompiled
  })
  useEffect(() => {
    connectionIdRef.current = connectionId
  })

  // 副作用 1：querySpec 变化 → 编译
  useEffect(() => {
    if (!autoRun) return
    if (!state.querySpec || !state.querySpec.table) return
    const fingerprint = JSON.stringify(state.querySpec)
    if (fingerprint === compiledSpecRef.current) return
    compiledSpecRef.current = fingerprint
    try {
      const compiled = compileQuerySpec(state.querySpec, schemaRef.current ?? undefined)
      dispatch({ type: "SET_COMPILED_SQL", compiledSql: compiled })
    } catch (error) {
      compiledSpecRef.current = null
      dispatch({
        type: "COMPILE_ERROR",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [state.querySpec, autoRun])

  // 副作用 2：compiledSql 变化 → 执行
  useEffect(() => {
    if (!autoRun) return
    if (!state.compiledSql) return
    const connectionId = connectionIdRef.current
    if (!connectionId) {
      dispatch({ type: "EXECUTE_ERROR", error: "未选择数据库连接" })
      return
    }
    let cancelled = false
    dispatch({ type: "EXECUTE_START" })
    executeRef
      .current(state.compiledSql, connectionId)
      .then((result) => {
        if (!cancelled) dispatch({ type: "EXECUTE_SUCCESS", result })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          dispatch({
            type: "EXECUTE_ERROR",
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [state.compiledSql, autoRun])

  // 副作用 3：needs_recompile → 判断重查
  useEffect(() => {
    if (state.status !== "needs_recompile") return
    if (!state.querySpec) return
    const fingerprint = JSON.stringify(state.querySpec)
    // querySpec 未变化（仅展示层变更，如映射/图表类型）→ 无需重查，回到 ready
    if (fingerprint === compiledSpecRef.current) {
      dispatch({ type: "SET_STATUS", status: "ready" })
    }
  }, [state.status, state.querySpec])

  return { session: state, dispatch }
}
