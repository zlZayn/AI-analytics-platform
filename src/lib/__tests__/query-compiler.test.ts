import { describe, expect, it } from "vitest"
import { compileQuerySpec } from "../query-compiler"
import type { SchemaData } from "@/types"

const schema: SchemaData = {
  version: 1,
  tables: [
    {
      name: "orders",
      columns: [
        { name: "id", type: "integer", nullable: false, isPrimary: true },
        { name: "customer_name", type: "text", nullable: true, isPrimary: false },
        { name: "amount", type: "numeric", nullable: true, isPrimary: false },
        { name: "created_at", type: "timestamp", nullable: true, isPrimary: false },
      ],
      rowEstimate: 1000,
    },
  ],
  relations: [],
}

describe("compileQuerySpec", () => {
  it("编译基础维度 + 度量查询", () => {
    const { sql, params } = compileQuerySpec(
      {
        table: "orders",
        dimensions: ["customer_name"],
        measures: [{ field: "amount", aggregation: "sum" }],
      },
      schema,
    )
    expect(sql).toContain('SELECT "customer_name", sum("amount") AS "sum_amount"')
    expect(sql).toContain('FROM "orders"')
    expect(sql).toContain('GROUP BY "customer_name"')
    expect(params).toEqual([])
  })

  it("过滤器全部参数化，防注入", () => {
    const { sql, params } = compileQuerySpec({
      table: "orders",
      dimensions: ["customer_name"],
      measures: [{ field: "amount", aggregation: "sum" }],
      filters: [
        { field: "customer_name", op: "eq", value: "O'Brien" },
        { field: "amount", op: "gt", value: 100 },
      ],
    })
    // 值绝不能内联到 SQL
    expect(sql).not.toContain("O'Brien")
    expect(sql).toContain('"customer_name" = $1')
    expect(sql).toContain('"amount" > $2')
    expect(params).toEqual(["O'Brien", 100])
  })

  it("支持 IN / BETWEEN / contains / is_null 操作符", () => {
    const { sql, params } = compileQuerySpec({
      table: "orders",
      dimensions: ["customer_name"],
      filters: [
        { field: "customer_name", op: "in", values: ["a", "b"] },
        { field: "amount", op: "between", values: [10, 20] },
        { field: "customer_name", op: "contains", value: "100%" },
        { field: "amount", op: "is_null" },
      ],
    })
    expect(sql).toContain('"customer_name" IN ($1, $2)')
    expect(sql).toContain('"amount" BETWEEN $3 AND $4')
    // LIKE 通配符转义，防止 %/_ 被当作通配符注入
    expect(sql).toContain("ILIKE $5 ESCAPE '\\'")
    expect(sql).toContain('"amount" IS NULL')
    expect(params).toEqual(["a", "b", 10, 20, "%100\\%%"])
  })

  it("支持 JOIN 与 HAVING", () => {
    const { sql, params } = compileQuerySpec({
      table: "orders",
      joins: [
        { table: "customers", type: "left", on: { left: "orders.customer_id", right: "customers.id" } },
      ],
      dimensions: ["customer_name"],
      measures: [{ field: "amount", aggregation: "sum", alias: "total" }],
      having: [{ field: "total", op: "gt", value: 1000 }],
    })
    expect(sql).toContain('LEFT JOIN "customers" ON "orders"."customer_id" = "customers"."id"')
    expect(sql).toContain("HAVING")
    expect(sql).toContain('"total" > $1')
    expect(params).toEqual([1000])
  })

  it("支持表达式维度（date_trunc / extract / concat）", () => {
    const { sql } = compileQuerySpec({
      table: "orders",
      dimensions: [
        { kind: "date_trunc", field: "created_at", part: "month" },
        { kind: "extract", field: "created_at", part: "year" },
        { kind: "concat", items: ["customer_name", " (", "合计", ")"] },
      ],
      measures: [{ field: "amount", aggregation: "sum" }],
    })
    expect(sql).toContain("date_trunc('month', \"created_at\") AS \"expr_0\"")
    expect(sql).toContain("extract(year from \"created_at\") AS \"expr_1\"")
    // 标识符项 → 列引用；其余 → 字符串字面量
    expect(sql).toContain("concat(\"customer_name\", ' (', '合计', ')') AS \"expr_2\"")
    expect(sql).toContain('GROUP BY date_trunc(\'month\', "created_at"), extract(year from "created_at"), concat("customer_name", \' (\', \'合计\', \')\')')
  })

  it("支持 sort 与 limit（数字安全拼接）", () => {
    const { sql } = compileQuerySpec({
      table: "orders",
      dimensions: ["customer_name"],
      sort: [{ field: "customer_name", direction: "desc" }],
      limit: 50,
    })
    expect(sql).toContain('ORDER BY "customer_name" DESC')
    expect(sql).toContain("LIMIT 50")
  })

  it("schema 校验：表不存在时抛出错误", () => {
    expect(() =>
      compileQuerySpec({ table: "nope", dimensions: ["id"] }, schema),
    ).toThrow(/表不存在/)
  })

  it("schema 校验：列不存在时抛出错误", () => {
    expect(() =>
      compileQuerySpec(
        { table: "orders", dimensions: ["missing_col"] },
        schema,
      ),
    ).toThrow(/列不存在/)
  })

  it("缺少 dimensions 和 measures 时抛出错误", () => {
    expect(() => compileQuerySpec({ table: "orders" })).toThrow(/至少需要/)
  })

  it("非法的 limit 抛出错误", () => {
    expect(() =>
      compileQuerySpec({ table: "orders", dimensions: ["id"], limit: -1 }),
    ).toThrow(/非法的 limit/)
  })
})
