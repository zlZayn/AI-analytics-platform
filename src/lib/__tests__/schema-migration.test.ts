import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("schema snapshot migration", () => {
  it("cleans duplicate active snapshots before adding a partial unique index", () => {
    const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20260725130000_unique_active_schema_snapshot/migration.sql"), "utf8")
    expect(sql).toMatch(/row_number\(\)[\s\S]*partition by connection_id/i)
    expect(sql).toMatch(/update schema_snapshots[\s\S]+status = 'archived'/i)
    expect(sql).toMatch(/create unique index[\s\S]+on schema_snapshots \(connection_id\)[\s\S]+where status = 'active'/i)
    expect(sql).toMatch(/alter table query_history[\s\S]+add column if not exists error_code text/i)
  })

  it("creates the analysis history table idempotently without touching business tables", () => {
    const sql = readFileSync(resolve(process.cwd(), "prisma/migrations/20260911193000_analysis_history/migration.sql"), "utf8")
    expect(sql).toMatch(/create table if not exists analysis_history/i)
    expect(sql).toMatch(/references connections \(id\) on delete cascade/i)
    expect(sql).toMatch(/create index if not exists analysis_history_connection_created_idx[\s\S]+created_at desc/i)
    expect(sql).not.toMatch(/drop table|truncate|delete from/i)
  })
})
