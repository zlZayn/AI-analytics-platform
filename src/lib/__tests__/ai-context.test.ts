import { describe, expect, it } from "vitest"
import {
  AI_EXECUTION_NOTE,
  CONTEXT_SOURCES,
  describeContextTrace,
  describeVisibility,
  normalizeReferencedTables,
} from "../ai-context"

describe("normalizeReferencedTables", () => {
  it("去空、去重、保持顺序", () => {
    expect(normalizeReferencedTables([" orders ", "orders", "", "customers", 7, null])).toEqual(["orders", "customers"])
  })

  it("非数组一律视为未提及", () => {
    expect(normalizeReferencedTables(undefined)).toEqual([])
    expect(normalizeReferencedTables("orders")).toEqual([])
  })
})

describe("describeContextTrace", () => {
  it("只输出长度与条数，不含内容", () => {
    const trace = describeContextTrace({
      schemaBytes: 16,
      profileBytes: 7,
      businessBytes: 0,
      historyTurns: 1,
      referencedTables: [],
    })

    expect(trace).toBe("schema=16 profile=7 business=0 history=1 mentions=auto")
    expect(trace).not.toContain("秘密问题")
  })
})

describe("可见范围声明", () => {
  it("摘要与明细来自同一份上下文声明", () => {
    const { summary, visible, hidden, note } = describeVisibility()

    for (const source of CONTEXT_SOURCES) {
      expect(summary).toContain(source.shortLabel)
      expect(visible.map((item) => item.label)).toContain(source.label)
    }
    expect(hidden.length).toBeGreaterThan(0)
    expect(note).toBe(AI_EXECUTION_NOTE)
    expect(summary).toContain("看不见原始数据行")
  })
})
