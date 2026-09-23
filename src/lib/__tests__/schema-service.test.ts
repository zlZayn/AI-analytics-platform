import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildDataProfileText,
  buildSchemaContext,
  scanSchema,
  type ColumnDataProfile,
  type ColumnInfo,
  type DatabaseSchema,
  type RelationInfo,
  type TableDataProfile,
  type TableInfo,
} from "../schema-service"

const stub = vi.hoisted(() => ({
  connection: null as
    | { host: string; port: number; database: string; username: string; passwordEncrypted: string; ssl: boolean }
    | null,
  configs: [] as Record<string, unknown>[],
  calls: [] as { sql: string; params: unknown[] | undefined }[],
  rows: new Map<string, unknown[]>(),
  throwOn: null as string | null,
  endCount: 0,
}))

// schema-service 在模块顶层就实例化两个配置敏感的单例（缺 ENCRYPTION_KEY / DATABASE_URL
// 会在 import 阶段直接抛），而 scanSchema 会真的 new Pool 去连库。
// 故把 prisma / encryption / pg 三个叶子模块换成可编排的空壳：
// 被测函数本身——SQL 文本、映射逻辑、资源回收——全部跑真实实现。
vi.mock("../prisma", () => ({
  prisma: { connection: { findUnique: async () => stub.connection } },
}))
vi.mock("../encryption", () => ({ decrypt: (value: string) => value }))
vi.mock("pg", () => ({
  Pool: class FakePool {
    constructor(config: Record<string, unknown>) {
      stub.configs.push(config)
    }
    async query(sql: string, params?: unknown[]) {
      stub.calls.push({ sql, params })
      if (stub.throwOn && sql.includes(stub.throwOn)) throw new Error("查询失败")
      for (const [key, rows] of stub.rows) {
        if (sql.includes(key)) return { rows }
      }
      return { rows: [] }
    }
    async end() {
      stub.endCount += 1
    }
  },
}))

const TABLES_KEY = "information_schema.tables t"
const COLUMNS_KEY = "information_schema.columns c"
const INDEXES_KEY = "pg_indexes"
const STATS_KEY = "reltuples"
const RELATIONS_KEY = "FOREIGN KEY"

function resetStub() {
  stub.connection = {
    host: "db.internal",
    port: 5432,
    database: "app",
    username: "analyst",
    passwordEncrypted: "cipher-text",
    ssl: true,
  }
  stub.configs.length = 0
  stub.calls.length = 0
  stub.rows.clear()
  stub.throwOn = null
  stub.endCount = 0
}

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

describe("scanSchema", () => {
  beforeEach(() => {
    resetStub()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("列 / 索引 / 行数估计 / 外键映射成 DatabaseSchema（时间戳冻结在整秒）", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"))
    stub.rows.set(TABLES_KEY, [{ table_name: "orders", table_comment: "订单表" }])
    stub.rows.set(COLUMNS_KEY, [
      { column_name: "id", data_type: "integer", is_nullable: "NO", column_default: "nextval('orders_id_seq'::regclass)", column_comment: null, is_primary: true },
      { column_name: "note", data_type: "text", is_nullable: "YES", column_default: null, column_comment: "备注", is_primary: false },
    ])
    stub.rows.set(INDEXES_KEY, [
      { indexname: "orders_pkey", indexdef: "CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)" },
      { indexname: "orders_region_idx", indexdef: "CREATE INDEX orders_region_idx ON public.orders USING btree (region)" },
    ])
    stub.rows.set(STATS_KEY, [{ estimate: "12345" }])
    stub.rows.set(RELATIONS_KEY, [
      { constraint_name: "fk_orders_user", from_table: "orders", from_column: "user_id", to_table: "users", to_column: "id" },
    ])

    const result = await scanSchema("conn-1")

    expect(result.version).toBe(Math.floor(Date.now() / 1000))
    expect(result.scannedAt.toISOString()).toBe("2026-01-02T03:04:05.000Z")
    expect(result.tables).toEqual([
      {
        name: "orders",
        schema: "public",
        comment: "订单表",
        columns: [
          { name: "id", type: "integer", nullable: false, isPrimary: true, comment: null, defaultValue: "nextval('orders_id_seq'::regclass)" },
          { name: "note", type: "text", nullable: true, isPrimary: false, comment: "备注", defaultValue: null },
        ],
        indexes: [
          { name: "orders_pkey", columns: [], unique: true },
          { name: "orders_region_idx", columns: [], unique: false },
        ],
        rowEstimate: 12345,
      },
    ])
    expect(result.relations).toEqual([
      { name: "fk_orders_user", fromTable: "orders", fromColumn: "user_id", toTable: "users", toColumn: "id" },
    ])
  })

  it("连接池按连接记录建，密码走 decrypt；用完关闭", async () => {
    await scanSchema("conn-1")

    expect(stub.configs).toHaveLength(1)
    expect(stub.configs[0]).toEqual({
      host: "db.internal",
      port: 5432,
      database: "app",
      user: "analyst",
      password: "cipher-text",
      ssl: true,
      max: 5,
    })
    expect(stub.endCount).toBe(1)
  })

  it("平台元数据表靠占位符参数排除，不拼进 SQL 字面量", async () => {
    await scanSchema("conn-1")

    const tablesCall = stub.calls[0]
    expect(tablesCall).toBeDefined()
    const placeholders = tablesCall?.sql.match(/\$\d+/g) ?? []
    expect(placeholders).toEqual(tablesCall?.params?.map((_, i) => `$${i + 1}`))
    expect(placeholders.length).toBe((tablesCall?.params ?? []).length)
    expect(tablesCall?.sql).not.toMatch(/'users'|'connections'/)
  })

  it("行数估计缺行时记 0，无外键时 relations 为空数组", async () => {
    stub.rows.set(TABLES_KEY, [{ table_name: "empty_t", table_comment: null }])

    const result = await scanSchema("conn-1")

    expect(result.tables).toEqual([
      { name: "empty_t", schema: "public", comment: null, columns: [], indexes: [], rowEstimate: 0 },
    ])
    expect(result.relations).toEqual([])
  })

  it("连接不存在时直接抛，且不建池也不关池", async () => {
    stub.connection = null

    await expect(scanSchema("conn-1")).rejects.toThrow("连接不存在")
    expect(stub.configs).toHaveLength(0)
    expect(stub.endCount).toBe(0)
  })

  it("扫描中途查询失败时仍然关闭连接池（finally 回收）", async () => {
    stub.rows.set(TABLES_KEY, [{ table_name: "orders", table_comment: null }])
    stub.throwOn = INDEXES_KEY

    await expect(scanSchema("conn-1")).rejects.toThrow("查询失败")
    expect(stub.endCount).toBe(1)
  })

  it("现状：每张表额外 3 次查询（列/索引/行数），合并成批量查询会让这条变红", async () => {
    stub.rows.set(TABLES_KEY, [
      { table_name: "orders", table_comment: null },
      { table_name: "users", table_comment: null },
    ])

    await scanSchema("conn-1")

    expect(stub.calls.map((c) => (c.sql.includes(TABLES_KEY) ? "tables" : c.sql.includes(COLUMNS_KEY) ? "columns" : c.sql.includes(INDEXES_KEY) ? "indexes" : c.sql.includes(STATS_KEY) ? "stats" : "relations")))
      .toEqual(["tables", "columns", "indexes", "stats", "columns", "indexes", "stats", "relations"])
  })
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
