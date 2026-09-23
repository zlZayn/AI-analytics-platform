import { NextRequest } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { apiFailure, apiSuccess, requestId } from '@/lib/api-response'
import type { InsightItem } from '@/lib/ai-contract'
import type { HistoryEntry, HistoryKind, NewHistoryEntry } from '@/types/history'

// 统一历史（AI 提问 + R 执行）：权威源就是本表，前端只读不写本地。
// SQL 执行历史在 query_history 表，两者读取期由 lib/history-merge.ts 合并。

/** 每个连接保留的条数上限（与前端时间线口径一致，新的在前） */
const HISTORY_LIMIT = 50

const isKind = (value: string): value is HistoryKind => value === 'ai' || value === 'r'

/** 结构化载荷 → Prisma JSON 字段（接口类型无索引签名，转换集中在这一处） */
const asJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue

/** 数据库行结构（不直接依赖生成类型，便于单测与坏数据兜底） */
interface HistoryRow {
  id: string
  connectionId: string
  sessionId: string
  kind: string
  ok: boolean
  question: string | null
  summary: string | null
  items: unknown
  code: string | null
  sourceSql: string | null
  output: unknown
  imageCount: number | null
  createdAt: Date
}

/** 行 → 时间线条目：结构不符（老数据/手工改库）返回 null，由调用方跳过，不打断列表 */
function toEntry(row: HistoryRow): HistoryEntry | null {
  const base = {
    id: row.id,
    connectionId: row.connectionId,
    sessionId: row.sessionId,
    createdAt: row.createdAt.toISOString(),
    ok: row.ok,
  }
  if (row.kind === 'ai') {
    if (typeof row.question !== 'string' || !Array.isArray(row.items)) return null
    return { ...base, kind: 'ai', question: row.question, summary: row.summary ?? '', items: row.items as InsightItem[] }
  }
  if (row.kind === 'r') {
    if (typeof row.code !== 'string') return null
    const output = Array.isArray(row.output) ? row.output.filter((line): line is string => typeof line === 'string') : []
    return {
      ...base,
      kind: 'r',
      code: row.code,
      sourceSql: row.sourceSql ?? undefined,
      output,
      imageCount: row.imageCount ?? undefined,
    }
  }
  return null
}

type ParseResult = { ok: true; entry: NewHistoryEntry } | { ok: false; message: string }

function parseNewEntry(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') return { ok: false, message: '请求体必须是 JSON 对象' }
  const value = body as Record<string, unknown>
  const connectionId = typeof value.connectionId === 'string' ? value.connectionId.trim() : ''
  const sessionId = typeof value.sessionId === 'string' ? value.sessionId.trim() : ''
  const kind = value.kind
  if (!connectionId || !sessionId) return { ok: false, message: '缺少必填字段: connectionId, sessionId' }
  if (kind !== 'ai' && kind !== 'r') return { ok: false, message: 'kind 只支持 ai / r' }
  const ok = typeof value.ok === 'boolean' ? value.ok : true
  const createdAt = typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
    ? new Date(value.createdAt).toISOString()
    : undefined

  if (kind === 'ai') {
    const question = typeof value.question === 'string' ? value.question.trim() : ''
    if (!question || !Array.isArray(value.items)) return { ok: false, message: 'AI 记录需要 question 与 items' }
    const summary = typeof value.summary === 'string' ? value.summary : ''
    return { ok: true, entry: { kind: 'ai', connectionId, sessionId, question, summary, ok, items: value.items as InsightItem[], createdAt } }
  }

  const code = typeof value.code === 'string' ? value.code : ''
  if (!code.trim()) return { ok: false, message: 'R 记录需要 code' }
  const output = Array.isArray(value.output) ? value.output.filter((line): line is string => typeof line === 'string') : []
  const sourceSql = typeof value.sourceSql === 'string' && value.sourceSql ? value.sourceSql : undefined
  const imageCount = typeof value.imageCount === 'number' && Number.isFinite(value.imageCount)
    ? Math.max(0, Math.trunc(value.imageCount))
    : undefined
  return { ok: true, entry: { kind: 'r', connectionId, sessionId, code, output, sourceSql, imageCount, ok, createdAt } }
}

/** 超出上限的旧记录按连接清理（保留最新 HISTORY_LIMIT 条） */
async function prune(connectionId: string): Promise<void> {
  const stale = await prisma.analysisHistory.findMany({
    where: { connectionId },
    orderBy: { createdAt: 'desc' },
    skip: HISTORY_LIMIT,
    select: { id: true },
  })
  if (stale.length === 0) return
  await prisma.analysisHistory.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } })
}

// 读取历史：按 connectionId 限定，可按 kind 过滤（新的在前）
export async function GET(request: NextRequest) {
  const id = requestId()
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    const kind = searchParams.get('kind')
    if (!connectionId) {
      return apiFailure({ code: 'INVALID_REQUEST', message: '缺少 connectionId', retryable: false }, 400, id)
    }
    if (kind && !isKind(kind)) {
      return apiFailure({ code: 'INVALID_REQUEST', message: 'kind 只支持 ai / r', retryable: false }, 400, id)
    }

    const rows = await prisma.analysisHistory.findMany({
      where: { connectionId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    })
    const entries = rows.map(toEntry).filter((entry): entry is HistoryEntry => entry !== null)
    return apiSuccess(entries, undefined, id)
  } catch (error) {
    console.error('获取分析历史失败', error)
    return apiFailure({ code: 'HISTORY_FETCH_FAILED', message: '获取历史记录失败，请稍后重试', retryable: true }, 500, id)
  }
}

// 追加一条历史（AI 提问 / R 执行）；重复提交不去重，由调用方保证一次执行一条
export async function POST(request: NextRequest) {
  const id = requestId()
  try {
    const parsed = parseNewEntry(await request.json().catch(() => null))
    if (!parsed.ok) {
      return apiFailure({ code: 'INVALID_REQUEST', message: parsed.message, retryable: false }, 400, id)
    }
    const { kind, connectionId, sessionId, ok, createdAt } = parsed.entry
    const created = await prisma.analysisHistory.create({
      data: {
        userId: 'default-user',
        connectionId,
        sessionId,
        kind,
        ok,
        question: kind === 'ai' ? parsed.entry.question : null,
        summary: kind === 'ai' ? parsed.entry.summary : null,
        ...(kind === 'ai' ? { items: asJson(parsed.entry.items) } : {}),
        code: kind === 'r' ? parsed.entry.code : null,
        sourceSql: kind === 'r' ? parsed.entry.sourceSql ?? null : null,
        ...(kind === 'r' ? { output: asJson(parsed.entry.output) } : {}),
        imageCount: kind === 'r' ? parsed.entry.imageCount ?? null : null,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    })
    await prune(connectionId)
    return apiSuccess(toEntry(created))
  } catch (error) {
    console.error('保存分析历史失败', error)
    return apiFailure({ code: 'HISTORY_CREATE_FAILED', message: '保存历史记录失败，不影响本次分析', retryable: true }, 500, id)
  }
}
