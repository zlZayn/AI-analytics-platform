// 共享类型定义

export interface Connection {
  id: string
  name: string
  description?: string
  host: string
  port: number
  database: string
  username?: string
  status: string
  tableCount?: number
  lastConnectedAt?: string
}

export interface QueryResult {
  columns: { name: string; type: string }[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
  returnedRowCount: number
  truncated: boolean
  rowLimit: number
}

export interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  isPrimary: boolean
  comment?: string
}

export interface SchemaTable {
  name: string
  comment?: string
  columns: SchemaColumn[]
  rowEstimate: number
}

export interface SchemaRelation {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  name?: string
}

export interface SchemaData {
  tables: SchemaTable[]
  relations: SchemaRelation[]
  version: number
}

export interface QueryHistoryItem {
  id: string
  sql: string
  rowCount: number
  executionTimeMs: number
  status: string
  errorCode?: string | null
  createdAt: string
}

export interface SavedQuery {
  id: string
  name: string
  sql: string
  executionCount?: number
  createdAt: string
}

export interface ApiError {
  code: string
  message: string
  retryable: boolean
}

export type ApiResponse<T, TMeta = Record<string, unknown>> =
  | { success: true; data: T; meta?: TMeta; requestId: string }
  | { success: false; error: ApiError; requestId: string }
