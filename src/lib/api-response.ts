import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

export interface ApiErrorInfo {
  code: string
  message: string
  retryable: boolean
}

export function requestId(): string {
  return randomUUID()
}

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>, id = requestId()) {
  return NextResponse.json({ success: true, data, ...(meta ? { meta } : {}), requestId: id })
}

export function apiFailure(message: string, status = 500, code = "INTERNAL_ERROR", retryable = false, id = requestId()) {
  const error: ApiErrorInfo = { code, message, retryable }
  return NextResponse.json({ success: false, error: message, errorInfo: error, requestId: id }, { status })
}

export function safeQueryError(error: unknown): ApiErrorInfo {
  const message = error instanceof Error ? error.message : "查询执行失败"
  if (/超时|statement timeout/i.test(message)) return { code: "QUERY_TIMEOUT", message: "查询超过允许时间，请缩小数据范围后重试", retryable: true }
  if (/只允许|不能修改|不能为空|括号|一条/i.test(message)) return { code: "INVALID_QUERY", message, retryable: false }
  if (/连接不存在/i.test(message)) return { code: "CONNECTION_NOT_FOUND", message, retryable: false }
  return { code: "QUERY_FAILED", message: "查询执行失败，请检查连接和 SQL", retryable: true }
}
