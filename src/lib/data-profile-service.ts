// 数据轮廓扫描：列的唯一值数 / NULL 数 / min-max / 样本值与喂给 AI 的 Markdown 文本。
// 连接与池的创建沿用 schema-service 的 getPool；平台表清单也由它一处声明（勿在此重复）。
import { PLATFORM_TABLES, getPool } from './schema-service'

export interface ColumnDataProfile {
  name: string
  type: string
  distinctCount: number
  nullCount: number
  min: number | string | null
  max: number | string | null
  samples: unknown[]
}

export interface TableDataProfile {
  table: string
  rowCount: number
  columns: ColumnDataProfile[]
}

const PROFILE_NUMERIC_TYPES = /int|numeric|decimal|real|double|float|serial|money/i
const PROFILE_TEMPORAL_TYPES = /date|time|timestamp|interval/i

function profileQuoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/** 只有可排序类型才计算 min/max（boolean/json/数组等不支持 min/max 聚合） */
function supportsMinMax(type: string): boolean {
  return (
    PROFILE_NUMERIC_TYPES.test(type) ||
    PROFILE_TEMPORAL_TYPES.test(type) ||
    /char|text/i.test(type)
  )
}

/**
 * 扫描单个表的列数据轮廓：唯一值数、NULL 数、min/max、样本值。
 * 每表 3 次查询：列清单 + 聚合统计 + 样本行。
 */
export async function scanDataProfile(
  connectionId: string,
  tableName: string,
): Promise<TableDataProfile> {
  const pool = await getPool(connectionId)
  try {
    // 1. 列清单
    const colsResult = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [tableName],
    )
    const columns = colsResult.rows as { column_name: string; data_type: string }[]
    const table = profileQuoteIdent(tableName)

    // 2. 聚合统计（单查询，按列支持性计算 min/max）
    const aggregates = columns.map((col, i) => {
      const c = profileQuoteIdent(col.column_name)
      const minMax = supportsMinMax(col.data_type)
        ? `, min(${c}) AS mn_${i}, max(${c}) AS mx_${i}`
        : ''
      return `count(${c}) AS n_${i}, count(DISTINCT ${c}) AS d_${i}${minMax}`
    })
    const countSql =
      aggregates.length > 0
        ? `SELECT count(*) AS total_count, ${aggregates.join(', ')} FROM ${table}`
        : `SELECT count(*) AS total_count FROM ${table}`
    const countResult = await pool.query(countSql)
    const stats = countResult.rows[0] ?? {}

    // 3. 样本值（单查询，最多 20 行，每列取至多 5 个不同非空值）
    const sampleSql =
      columns.length > 0
        ? `SELECT ${columns.map((col) => profileQuoteIdent(col.column_name)).join(', ')} FROM ${table} LIMIT 20`
        : `SELECT * FROM ${table} LIMIT 20`
    const sampleResult = await pool.query(sampleSql)

    const rowCount = Number(stats.total_count ?? 0)
    const profiles: ColumnDataProfile[] = columns.map((col, i) => {
      const samples: unknown[] = []
      const seen = new Set<string>()
      for (const row of sampleResult.rows) {
        const v = row[col.column_name]
        if (v !== null && v !== undefined && v !== '') {
          const key = String(v)
          if (!seen.has(key)) {
            seen.add(key)
            samples.push(v)
          }
          if (samples.length >= 5) break
        }
      }
      return {
        name: col.column_name,
        type: col.data_type,
        distinctCount: Number(stats[`d_${i}`] ?? 0),
        nullCount: rowCount - Number(stats[`n_${i}`] ?? 0),
        min: (stats[`mn_${i}`] ?? null) as number | string | null,
        max: (stats[`mx_${i}`] ?? null) as number | string | null,
        samples,
      }
    })

    return { table: tableName, rowCount, columns: profiles }
  } finally {
    await pool.end()
  }
}

/** 扫描所有用户表（默认最多 10 个）的数据轮廓 */
export async function scanAllDataProfiles(
  connectionId: string,
  maxTables = 10,
): Promise<TableDataProfile[]> {
  const pool = await getPool(connectionId)
  let tableNames: string[]
  try {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name NOT IN (${PLATFORM_TABLES.map((_, i) => `$${i + 1}`).join(',')})
       ORDER BY table_name LIMIT $${PLATFORM_TABLES.length + 1}`,
      [...PLATFORM_TABLES, maxTables],
    )
    tableNames = result.rows.map((r) => r.table_name as string)
  } finally {
    await pool.end()
  }
  const profiles: TableDataProfile[] = []
  for (const name of tableNames) {
    profiles.push(await scanDataProfile(connectionId, name))
  }
  return profiles
}

/** 生成 Markdown 表格格式的 Prompt 文本 */
export function buildDataProfileText(profiles: TableDataProfile[]): string {
  if (profiles.length === 0) return ''
  let text = '## 数据轮廓（辅助判断字段类型与基数）\n\n'
  for (const profile of profiles) {
    text += `### ${profile.table}（${profile.rowCount} 行）\n\n`
    text += '| 列 | 类型 | 唯一值 | NULL | 最小值 | 最大值 | 样本 |\n'
    text += '|----|------|--------|------|--------|--------|------|\n'
    for (const col of profile.columns) {
      const samples = col.samples
        .slice(0, 3)
        .map((s) => `\`${String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')}\``)
        .join(', ')
      const min = col.min !== null ? String(col.min).replace(/\|/g, '\\|') : ''
      const max = col.max !== null ? String(col.max).replace(/\|/g, '\\|') : ''
      text += `| ${col.name} | ${col.type} | ${col.distinctCount} | ${col.nullCount} | ${min} | ${max} | ${samples} |\n`
    }
    text += '\n'
  }
  return text
}
