import { describe, expect, it, vi } from "vitest"
import {
  buildDataProfileText,
  buildSchemaContext,
  type ColumnDataProfile,
  type ColumnInfo,
  type DatabaseSchema,
  type RelationInfo,
  type TableDataProfile,
  type TableInfo,
} from "../schema-service"

// schema-service 在模块顶层就实例化两个配置敏感的单例（缺 ENCRYPTION_KEY / DATABASE_URL
// 会在 import 阶段直接抛），本文件只测纯文本生成，不碰任何连接与加解密，
// 故把这两个叶子模块换成最小空壳（vitest 会把 vi.mock 提到 import 之前）。
vi.mock("../prisma", () => ({ prisma: {} }))
vi.mock("../encryption", () => ({ decrypt: (value: string) => value }))

const column = (over: Partial<ColumnInfo> & { name: string; type: string }): ColumnInfo => ({
  nullable: true,
  isPrimary: false,
  ...over,
})

const table = (over: Partial<TableInfo> & { name: string }): TableInfo => ({
  schema: "public",
  columns: [],
  indexes: [],
  rowEstimate: 0,
  ...over,
})

const schema = (tables: TableInfo[], relations: RelationInfo[] = []): DatabaseSchema => ({
  version: 1,
  scannedAt: new Date(0),
  tables,
  relations,
})

const profileColumn = (over: Partial<ColumnDataProfile> & { name: string; type: string }): ColumnDataProfile => ({
  distinctCount: 0,
  nullCount: 0,
  min: null,
  max: null,
  samples: [],
  ...over,
})

const profile = (table: string, rowCount: number, columns: ColumnDataProfile[]): TableDataProfile => ({
  table,
  rowCount,
  columns,
})

describe("buildSchemaContext", () => {
  it("骨架：标题 + 约束语 + 表结构小节 + 表名", () => {
    const text = buildSchemaContext(schema([table({ name: "orders", columns: [column({ name: "id", type: "integer", nullable: false, isPrimary: true })] })]))

    expect(text.startsWith("## 数据库结构\n\n")).toBe(true)
    expect(text).toContain("只使用下方真实存在的表、列和关系")
    expect(text).toContain("### 表结构详情\n\n#### orders\n- id integer PK NOT NULL\n")
  })

  it("列行按 名称 类型 PK NOT NULL -- 注释 顺序拼接，可空列不出 NOT NULL", () => {
    const text = buildSchemaContext(
      schema([
        table({
          name: "orders",
          columns: [
            column({ name: "id", type: "integer", nullable: false, isPrimary: true }),
            column({ name: "amount", type: "numeric", nullable: false }),
            column({ name: "note", type: "text", comment: "备注" }),
          ],
        }),
      ]),
    )

    expect(text).toContain("- id integer PK NOT NULL\n")
    expect(text).toContain("- amount numeric NOT NULL\n")
    expect(text).toContain("- note text -- 备注\n")
  })

  it("无关系时不出表关系小节；有关系时按 from.col -> to.col 列出", () => {
    expect(buildSchemaContext(schema([]))).not.toContain("### 表关系")

    const withRelation = buildSchemaContext(
      schema([], [{ name: "fk1", fromTable: "orders", fromColumn: "user_id", toTable: "users", toColumn: "id" }]),
    )
    expect(withRelation).toContain("### 表关系\n- orders.user_id -> users.id\n")
  })

  it("零列的表仍输出表名；表级 comment 现状不进入 prompt（钉住现状，不是主张契约）", () => {
    const text = buildSchemaContext(schema([table({ name: "empty", comment: "这张表没有列" })]))

    expect(text).toContain("#### empty\n")
    expect(text).not.toContain("这张表没有列")
  })
})

describe("buildDataProfileText", () => {
  it("空数组返回空串：没有轮廓时整段不出现", () => {
    expect(buildDataProfileText([])).toBe("")
  })

  it("Markdown 表格骨架，样本只取前 3 个", () => {
    const text = buildDataProfileText([
      profile("orders", 1234, [
        profileColumn({ name: "amount", type: "numeric", distinctCount: 900, nullCount: 34, min: 1, max: 999, samples: [10, 20, 30, 40] }),
      ]),
    ])

    expect(text.startsWith("## 数据轮廓（辅助判断字段类型与基数）\n\n")).toBe(true)
    expect(text).toContain("### orders（1234 行）\n\n")
    expect(text).toContain("| 列 | 类型 | 唯一值 | NULL | 最小值 | 最大值 | 样本 |\n")
    expect(text).toContain("|----|------|--------|------|--------|--------|------|\n")
    expect(text).toContain("| amount | numeric | 900 | 34 | 1 | 999 | `10`, `20`, `30` |\n")
    expect(text).not.toContain("`40`")
  })

  it("min/max 为 null 时留空单元格，不写 null", () => {
    const text = buildDataProfileText([
      profile("orders", 5, [profileColumn({ name: "flag", type: "boolean", distinctCount: 2 })]),
    ])

    expect(text).toContain("| flag | boolean | 2 | 0 |  |  |  |\n")
    expect(text).not.toContain("null")
  })

  it("样本转义竖线并把换行折成空格；min/max 只转义竖线（现状：极值含换行会撑破表格）", () => {
    const text = buildDataProfileText([
      profile("orders", 5, [
        profileColumn({ name: "raw", type: "text", distinctCount: 3, min: "a|b", max: "c\nd", samples: ["x|y", "p\nq"] }),
      ]),
    ])

    expect(text).toContain("| raw | text | 3 | 0 | a\\|b | c\nd | `x\\|y`, `p q` |\n")
  })

  it("多表按顺序拼接，表与表之间留一个空行", () => {
    const text = buildDataProfileText([
      profile("orders", 1234, [profileColumn({ name: "a", type: "integer", distinctCount: 1, min: 1, max: 1 })]),
      profile("users", 7, []),
    ])

    expect(text).toContain("### orders（1234 行）")
    expect(text).toContain("|\n\n### users（7 行）\n\n")
  })
})
