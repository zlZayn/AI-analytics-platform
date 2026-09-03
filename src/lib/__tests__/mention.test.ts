import { describe, expect, it } from "vitest"
import { extractMentions, extractPendingMention, filterTables, replaceMention } from "@/lib/mention"

const tables = [
  { name: "orders", columns: [{ name: "id" }] },
  { name: "order_items", columns: [{ name: "order_id" }] },
  { name: "customers", columns: [{ name: "id" }] },
]

describe("extractPendingMention", () => {
  it("returns the last word starting with @", () => {
    expect(extractPendingMention("分析 @ord")).toBe("ord")
  })

  it("returns null without an @ word", () => {
    expect(extractPendingMention("分析销售额")).toBeNull()
    expect(extractPendingMention("")).toBeNull()
  })

  it("ignores @ in the middle of a sentence", () => {
    expect(extractPendingMention("分析 @orders 的销售")).toBeNull()
  })

  it("triggers when @ directly follows CJK text", () => {
    expect(extractPendingMention("对比@orders")).toBe("orders")
    expect(extractPendingMention("对比@")).toBe("")
  })

  it("does not treat email-style @ as a mention", () => {
    expect(extractPendingMention("联系 user@mail.com")).toBeNull()
    expect(extractPendingMention("a@b 分析")).toBeNull()
  })
})

describe("replaceMention", () => {
  it("replaces the completed @ word with @name", () => {
    expect(replaceMention("分析 @ord", "orders")).toBe("分析 @orders ")
  })

  it("keeps text after the mention", () => {
    expect(replaceMention("分析 @ord 的销售趋势", "orders")).toBe("分析 @orders 的销售趋势")
  })

  it("completes a bare @", () => {
    expect(replaceMention("分析 @", "orders")).toBe("分析 @orders ")
  })

  it("replaces only the last @ word", () => {
    expect(replaceMention("对比 @orders 与 @", "customers")).toBe("对比 @orders 与 @customers ")
  })

  it("appends mention when no @ present", () => {
    expect(replaceMention("分析", "orders")).toBe("分析@orders ")
  })
})

describe("extractMentions", () => {
  it("extracts all @mentions deduplicated", () => {
    expect(extractMentions("对比 @orders 与 @customers，再看 @orders")).toEqual(["orders", "customers"])
  })

  it("returns empty array without mentions", () => {
    expect(extractMentions("分析销售额")).toEqual([])
  })
})

describe("filterTables", () => {
  it("filters by case-insensitive substring", () => {
    expect(filterTables(tables, "ORDER")).toEqual([tables[0], tables[1]])
  })

  it("returns all tables for empty query", () => {
    expect(filterTables(tables, "")).toEqual(tables)
  })

  it("returns empty when nothing matches", () => {
    expect(filterTables(tables, "nope")).toEqual([])
  })
})