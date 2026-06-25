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
  createdAt: string
}

export interface SavedQuery {
  id: string
  name: string
  sql: string
  executionCount?: number
  createdAt: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
