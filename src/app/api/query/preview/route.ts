import { NextRequest } from "next/server"
import { apiFailure, apiSuccess, requestId, safeQueryError } from "@/lib/api-response"
import { executeQuery } from "@/lib/query-engine"
import { quotePostgresIdentifier } from "@/lib/sql-identifiers"

const PREVIEW_ROW_LIMIT = 100

export async function POST(request: NextRequest) {
  const id = requestId()
  try {
    const body: unknown = await request.json()
    if (!isRecord(body) || typeof body.connectionId !== "string" || typeof body.schema !== "string" || typeof body.table !== "string") {
      return apiFailure({ code: "INVALID_REQUEST", message: "缺少必填字段: connectionId, schema, table", retryable: false }, 400, id)
    }
    const relation = `${quotePostgresIdentifier(body.schema)}.${quotePostgresIdentifier(body.table)}`
    const result = await executeQuery(body.connectionId, `SELECT * FROM ${relation} LIMIT ${PREVIEW_ROW_LIMIT}`, 10_000, request.signal)
    return apiSuccess(result, { previewRowLimit: PREVIEW_ROW_LIMIT }, id)
  } catch (error) {
    const safe = safeQueryError(error)
    const invalidIdentifier = error instanceof Error && error.message.startsWith("标识符")
    return apiFailure(
      invalidIdentifier ? { code: "INVALID_IDENTIFIER", message: error.message, retryable: false } : safe,
      invalidIdentifier ? 400 : safe.code === "QUERY_CANCELLED" ? 499 : safe.code === "QUERY_TIMEOUT" ? 504 : 500,
      id,
    )
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
