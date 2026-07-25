import { describe, expect, it } from "vitest"
import { quotePostgresIdentifier } from "../sql-identifiers"

describe("quotePostgresIdentifier", () => {
  it("quotes ordinary and embedded-quote identifiers", () => {
    expect(quotePostgresIdentifier("public")).toBe('"public"')
    expect(quotePostgresIdentifier('sales"archive')).toBe('"sales""archive"')
  })

  it("rejects empty, control-character, and oversized identifiers", () => {
    expect(() => quotePostgresIdentifier("")).toThrow("标识符不能为空")
    expect(() => quotePostgresIdentifier("bad\nname")).toThrow("标识符包含非法字符")
    expect(() => quotePostgresIdentifier("x".repeat(129))).toThrow("标识符过长")
  })
})
