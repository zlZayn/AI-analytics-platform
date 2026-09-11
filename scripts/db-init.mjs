// 元库初始化：把 prisma/bootstrap.sql 应用到 DATABASE_URL 指向的库。
//
// 幂等：全部 CREATE ... IF NOT EXISTS，可重复执行；空库从零建到可用状态，现有库只补缺失对象。
// 用法：npm run db:init（由 npm 读 .env）；或 node --env-file=<env 文件> scripts/db-init.mjs
// 禁止 db push / migrate：元库与业务表（fact_* / dim_*）同库，那两个命令会 DROP 业务表。

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const bootstrapPath = resolve(dirname(fileURLToPath(import.meta.url)), "../prisma/bootstrap.sql")

async function names(client, sql) {
  const { rows } = await client.query(sql)
  return new Set(rows.map((row) => row.name))
}

const TABLE_SQL = "select table_name as name from information_schema.tables where table_schema = 'public'"
const INDEX_SQL = "select indexname as name from pg_indexes where schemaname = 'public'"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("缺少 DATABASE_URL：请用 npm run db:init（读 .env），或 node --env-file=<env 文件> scripts/db-init.mjs")
    process.exitCode = 1
    return
  }

  const sql = readFileSync(bootstrapPath, "utf8")
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const tablesBefore = await names(client, TABLE_SQL)
    const indexesBefore = await names(client, INDEX_SQL)

    await client.query("begin")
    await client.query(sql)
    await client.query("commit")

    const tablesAfter = await names(client, TABLE_SQL)
    const indexesAfter = await names(client, INDEX_SQL)
    const createdTables = [...tablesAfter].filter((name) => !tablesBefore.has(name)).sort()
    const createdIndexes = [...indexesAfter].filter((name) => !indexesBefore.has(name)).sort()

    console.log("元库初始化完成（幂等，可重复执行）")
    console.log("  新建表：" + (createdTables.length ? createdTables.join(", ") : "无（已是最新）"))
    console.log("  新建索引：" + (createdIndexes.length ? createdIndexes.join(", ") : "无（已是最新）"))
    console.log("  public schema 现有表：" + tablesAfter.size + " 张")
  } catch (error) {
    await client.query("rollback").catch(() => {})
    console.error("元库初始化失败（已回滚，未改动任何数据）：" + error.message)
    if (/schema_snapshots_one_active_per_connection|duplicate key/i.test(error.message)) {
      console.error("  提示：库里存在重复的 active 快照，先清理重复（见 prisma/migrations/20260725130000_unique_active_schema_snapshot/）再重试")
    }
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

await main()
