import { describe, expect, it } from "vitest"
import type { AnalysisSession, DisplayConfig } from "@/types/session"
import type { SchemaData } from "@/types"
import { createInitialSession, createSessionReducer, missingMappingFields } from "../sessionReducer"

const schema: SchemaData = {
  version: 1,
  tables: [
    {
      name: "orders",
      columns: [
        { name: "customer_name", type: "text", nullable: true, isPrimary: false },
        { name: "amount", type: "numeric", nullable: true, isPrimary: false },
        { name: "created_at", type: "timestamp", nullable: true, isPrimary: false },
        { name: "is_vip", type: "boolean", nullable: true, isPrimary: false },
      ],
      rowEstimate: 1000,
    },
  ],
  relations: [],
}

const barConfig: DisplayConfig = {
  chartType: "bar",
  mapping: { chartType: "bar", x: "customer_name", y: "amount", mode: "grouped" },
}

function makeSession(overrides: Partial<AnalysisSession> = {}): AnalysisSession {
  return createInitialSession({
    id: "test-session",
    displayConfig: barConfig,
    ...overrides,
  })
}

describe("createInitialSession", () => {
  it("默认状态为 idle，table 图表，空 querySpec", () => {
    const s = createInitialSession()
    expect(s.status).toBe("idle")
    expect(s.displayConfig.chartType).toBe("table")
    expect(s.querySpec).toEqual({ table: "" })
    expect(s.result).toBeNull()
    expect(s.compiledSql).toBeNull()
    expect(s.isUserModified).toBe(false)
    expect(s.conversationHistory).toEqual([])
    expect(s.id).toBeTruthy()
  })
})

describe("createSessionReducer（无 schema）", () => {
  const reducer = createSessionReducer({ schema: null })
  const base = makeSession()

  it("ASK_AI 记录问题并追加用户消息", () => {
    const next = reducer(base, { type: "ASK_AI", question: "本月销量如何？" })
    expect(next.question).toBe("本月销量如何？")
    expect(next.conversationHistory).toHaveLength(1)
    expect(next.conversationHistory[0]).toMatchObject({ role: "user", content: "本月销量如何？" })
    expect(next.source).toBe("user")
  })

  it("SET_COMPILED_SQL 置为 executing 并保存编译结果", () => {
    const next = reducer(base, {
      type: "SET_COMPILED_SQL",
      compiledSql: { sql: 'SELECT 1 FROM "orders"', params: [] },
    })
    expect(next.status).toBe("executing")
    expect(next.compiledSql?.sql).toContain("orders")
    expect(next.error).toBeUndefined()
  })

  it("COMPILE_ERROR 置为 error 并清空 compiledSql", () => {
    const compiled = makeSession({ compiledSql: { sql: "SELECT 1", params: [] } })
    const next = reducer(compiled, { type: "COMPILE_ERROR", error: "列不存在" })
    expect(next.status).toBe("error")
    expect(next.error).toBe("列不存在")
    expect(next.compiledSql).toBeNull()
  })

  it("EXECUTE_SUCCESS 置为 ready 并保存结果", () => {
    const next = reducer(base, {
      type: "EXECUTE_SUCCESS",
      result: {
        columns: [{ name: "customer_name", type: "text", semanticType: "text" }],
        rows: [],
        rowCount: 0,
        executionTimeMs: 5,
        returnedRowCount: 0,
        truncated: false,
        rowLimit: 5000,
      },
    })
    expect(next.status).toBe("ready")
    expect(next.result?.rowCount).toBe(0)
    expect(next.error).toBeUndefined()
  })

  it("EXECUTE_ERROR 置为 error", () => {
    const next = reducer(base, { type: "EXECUTE_ERROR", error: "查询超时" })
    expect(next.status).toBe("error")
    expect(next.error).toBe("查询超时")
  })

  it("UPDATE_QUERY_SPEC 置为 needs_recompile 并标记用户修改", () => {
    const next = reducer(base, {
      type: "UPDATE_QUERY_SPEC",
      querySpec: { table: "orders", dimensions: ["customer_name"], limit: 10 },
    })
    expect(next.status).toBe("needs_recompile")
    expect(next.isUserModified).toBe(true)
    expect(next.querySpec.limit).toBe(10)
  })

  it("UPDATE_DISPLAY_CONFIG 引用了结果外的字段 → needs_recompile", () => {
    const withResult = makeSession({
      result: {
        columns: [
          { name: "customer_name", type: "text", semanticType: "text" },
          { name: "amount", type: "numeric", semanticType: "numeric" },
        ],
        rows: [],
        rowCount: 0,
        executionTimeMs: 5,
        returnedRowCount: 0,
        truncated: false,
        rowLimit: 5000,
      },
      status: "ready",
    })
    const next = reducer(withResult, {
      type: "UPDATE_DISPLAY_CONFIG",
      displayConfig: {
        chartType: "bar",
        mapping: { chartType: "bar", x: "ghost", y: "amount" },
      },
    })
    expect(next.status).toBe("needs_recompile")
  })

  it("CHANGE_CHART_TYPE 只改图表类型，不触发重查", () => {
    const ready = makeSession({ status: "ready" })
    const next = reducer(ready, { type: "CHANGE_CHART_TYPE", chartType: "line" })
    expect(next.displayConfig.chartType).toBe("line")
    expect(next.status).toBe("ready")
    expect(next.isUserModified).toBe(true)
  })

  it("RESET 生成全新会话（可带覆盖）", () => {
    const next = reducer(base, { type: "RESET", payload: { question: "重置后" } })
    expect(next.question).toBe("重置后")
    expect(next.status).toBe("idle")
    expect(next.conversationHistory).toEqual([])
  })

  it("ADD_CONVERSATION / SET_QUESTION / CLEAR_ERROR / MARK_USER_MODIFIED / SET_STATUS", () => {
    const s = reducer(
      makeSession({ error: "旧错误" }),
      { type: "ADD_CONVERSATION", message: { role: "assistant", content: "你好", createdAt: new Date() } },
    )
    expect(s.conversationHistory).toHaveLength(1)

    const s2 = reducer(s, { type: "SET_QUESTION", question: "新问题" })
    expect(s2.question).toBe("新问题")

    const s3 = reducer(s2, { type: "CLEAR_ERROR" })
    expect(s3.error).toBeUndefined()

    const s4 = reducer(s3, { type: "MARK_USER_MODIFIED" })
    expect(s4.isUserModified).toBe(true)

    const s5 = reducer(s4, { type: "SET_STATUS", status: "compiling" })
    expect(s5.status).toBe("compiling")
  })
})

describe("createSessionReducer（带 schema）", () => {
  const reducer = createSessionReducer({ schema })

  it("INIT_FROM_AI 初始化会话并进入编译流程（schema 校验通过）", () => {
    const next = reducer(makeSession(), {
      type: "INIT_FROM_AI",
      payload: {
        question: "各客户销售额",
        title: "客户销售额",
        insight: "洞察文本",
        querySpec: {
          table: "orders",
          dimensions: ["customer_name"],
          measures: [{ field: "amount", aggregation: "sum" }],
        },
        displayConfig: barConfig,
      },
    })
    expect(next.status).toBe("compiling")
    expect(next.question).toBe("各客户销售额")
    expect(next.title).toBe("客户销售额")
    expect(next.source).toBe("ai")
    expect(next.isUserModified).toBe(false)
    expect(next.compiledSql).toBeNull()
    expect(next.result).toBeNull()
  })

  it("INIT_FROM_AI 对不兼容的 displayConfig 不阻断（校验结果仅内部使用）", () => {
    const badConfig: DisplayConfig = {
      chartType: "bar",
      mapping: { chartType: "bar", x: "customer_name", y: "customer_name" },
    }
    const next = reducer(makeSession(), {
      type: "INIT_FROM_AI",
      payload: {
        question: "q",
        querySpec: { table: "orders", dimensions: ["customer_name"] },
        displayConfig: badConfig,
      },
    })
    // 状态仍正常建立；类型不匹配留给展示层处理
    expect(next.status).toBe("compiling")
    expect(next.displayConfig.mapping.chartType).toBe("bar")
  })

  it("EXECUTE_SUCCESS 将 data-based 校验结果存入 validationIssues（无效数值）", () => {
    const next = reducer(makeSession(), {
      type: "EXECUTE_SUCCESS",
      result: {
        columns: [
          { name: "customer_name", type: "text", semanticType: "text" },
          { name: "amount", type: "numeric", semanticType: "numeric" },
        ],
        rows: [
          { customer_name: "A", amount: 10 },
          { customer_name: "B", amount: "oops" },
        ],
        rowCount: 2,
        executionTimeMs: 5,
        returnedRowCount: 2,
        truncated: false,
        rowLimit: 5000,
      },
    })
    expect(next.status).toBe("ready")
    expect(next.result?.rowCount).toBe(2)
    expect(next.validationIssues?.some((i) => i.code === "INVALID_NUMERIC")).toBe(true)
  })

  it("EXECUTE_SUCCESS 校验通过时 validationIssues 为 undefined", () => {
    const next = reducer(makeSession(), {
      type: "EXECUTE_SUCCESS",
      result: {
        columns: [
          { name: "customer_name", type: "text", semanticType: "text" },
          { name: "amount", type: "numeric", semanticType: "numeric" },
        ],
        rows: [
          { customer_name: "A", amount: 10 },
          { customer_name: "B", amount: 20 },
        ],
        rowCount: 2,
        executionTimeMs: 5,
        returnedRowCount: 2,
        truncated: false,
        rowLimit: 5000,
      },
    })
    expect(next.status).toBe("ready")
    expect(next.validationIssues).toBeUndefined()
  })

  it("CHANGE_CHART_TYPE 清除过期 validationIssues", () => {
    const withIssues = makeSession({
      status: "ready",
      validationIssues: [{ code: "INVALID_NUMERIC", message: "amount 有 1 个无效数值", severity: "warning" }],
    })
    const next = reducer(withIssues, { type: "CHANGE_CHART_TYPE", chartType: "line" })
    expect(next.displayConfig.chartType).toBe("line")
    expect(next.validationIssues).toBeUndefined()
  })
})

describe("missingMappingFields", () => {
  it("返回引用但不存在的字段", () => {
    const missing = missingMappingFields(
      { chartType: "bar", x: "customer_name", y: "ghost" },
      ["customer_name", "amount"],
    )
    expect(missing).toEqual(["ghost"])
  })

  it("correlation.columns 参与检查", () => {
    const missing = missingMappingFields(
      { chartType: "correlation", columns: ["amount", "nope"], method: "pearson" },
      ["amount"],
    )
    expect(missing).toEqual(["nope"])
  })

  it("全部存在时返回空数组", () => {
    const missing = missingMappingFields(
      { chartType: "bar", x: "customer_name", y: "amount" },
      ["customer_name", "amount"],
    )
    expect(missing).toEqual([])
  })
})
