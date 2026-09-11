// 只读漂移检查：比对 prisma/schema.prisma 的模型/字段与库里的实际表/列。
//
// 只读：不建表、不改数据、不连接业务库里的业务表。漂移时退出码 1，并给出修复入口。
// 用法：npm run db:check（由 npm 读 .env）；或 node --env-file=<env 文件> scripts/check-db-drift.mjs

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), "../prisma/schema.prisma")

/** 从 schema.prisma 抽出 表名 → 列名集合（关系字段与 enum 字段不算列；先收集全部模型名再解析字段，避免前向引用被当成列） */
function parseSchema(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim())
  const modelNames = new Set()
  const enumNames = new Set()
  for (const line of lines) {
    const model = line.match(/^model\s+(\w+)\s*\{/)
    if (model) modelNames.add(model[1])
    const enumType = line.match(/^enum\s+(\w+)\s*\{/)
    if (enumType) enumNames.add(enumType[1])
  }

  const models = new Map()
  let current = null
  for (const line of lines) {
    const model = line.match(/^model\s+(\w+)\s*\{/)
    if (model) {
      current = { name: model[1], table: model[1], columns: new Set() }
      models.set(current.name, current)
      continue
    }
    if (/^enum\s+\w+\s*\{/.test(line)) {
      current = null
      continue
    }
    if (!current) continue
    if (line === "}") {
      current = null
      continue
    }
    if (line.startsWith("@@")) {
      const mapped = line.match(/@@map\("([^"]+)"\)/)
      if (mapped) current.table = mapped[1]
      continue
    }
    const field = line.match(/^(\w+)\s+([A-Za-z_][\w[\]]*\??)(.*)$/)
    if (!field) continue
    const [, name, type, attrs] = field
    const base = type.replace(/[[\]?]/g, "")
    if (modelNames.has(base) || enumNames.has(base)) continue
    const mapped = attrs.match(/@map\("([^"]+)"\)/)
    current.columns.add(mapped ? mapped[1] : name)
  }
  return models
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("缺少 DATABASE_URL：请用 npm run db:check（读 .env），或 node --env-file=<env 文件> scripts/check-db-drift.mjs")
    process.exitCode = 1
    return
  }

  const models = parseSchema(readFileSync(schemaPath, "utf8"))
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const { rows: tableRows } = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public'",
    )
    const tables = new Set(tableRows.map((row) => row.table_name))
    const { rows: columnRows } = await client.query(
      "select table_name, column_name from information_schema.columns where table_schema = 'public'",
    )
    const columns = new Map()
    for (const row of columnRows) {
      if (!columns.has(row.table_name)) columns.set(row.table_name, new Set())
      columns.get(row.table_name).add(row.column_name)
    }

    const missingTables = []
    const missingColumns = []
    for (const model of models.values()) {
      if (!tables.has(model.table)) {
        missingTables.push(model.table)
        continue
      }
      for (const column of model.columns) {
        if (!columns.get(model.table).has(column)) missingColumns.push(model.table + "." + column)
      }
    }
    missingTables.sort()
    missingColumns.sort()

    const { rows: indexRows } = await client.query(
      "select 1 from pg_indexes where schemaname = 'public' and indexname = 'schema_snapshots_one_active_per_connection'",
    )
    const missingInvariant = indexRows.length === 0

    if (missingTables.length === 0 && missingColumns.length === 0 && !missingInvariant) {
      console.log("元库结构无漂移：schema.prisma 的 " + models.size + " 个模型在库中均存在（表与列齐全）")
      return
    }
    console.error("元库结构与 schema.prisma 不一致：")
    if (missingTables.length) console.error("  缺表：" + missingTables.join(", "))
    if (missingColumns.length) console.error("  缺列：" + missingColumns.join(", "))
    if (missingInvariant) console.error("  缺索引：schema_snapshots_one_active_per_connection（每连接最多一个 active 快照）")
    console.error("  修复入口：npm run db:init（幂等补缺失对象）；schema 有新增字段时同时补 prisma/bootstrap.sql 与 prisma/migrations/ 增量补丁")
    process.exitCode = 1
  } catch (error) {
    console.error("漂移检查失败：" + error.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

await main()
