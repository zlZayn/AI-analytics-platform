/** Normalize SQL carried between pages without changing its query semantics. */
export function normalizeWorkspaceSql(sql: string): string {
  return sql.replace(/\r\n?/g, "\n").trim()
}

/** Stable key used to apply one navigation payload exactly once. */
export function workspaceSqlKey(connectionId: string | null, sql: string): string | null {
  const connection = connectionId?.trim()
  const query = normalizeWorkspaceSql(sql)
  if (!connection || !query) return null
  return `${connection}\u0000${query}`
}

/** Build the canonical URL used by pages that send SQL to the workbench. */
export function buildWorkspaceUrl(connectionId: string | null, sql = ""): string | null {
  const connection = connectionId?.trim()
  const query = normalizeWorkspaceSql(sql)
  if (!connection || !query) return null
  return `/workspace?connection=${encodeURIComponent(connection)}&sql=${encodeURIComponent(query)}`
}

/**
 * 历史回放的导航 URL：SQL 走统一入口；R 历史额外带 `r=<history id>`。
 * R 代码不进 URL（体积大且 sessionStorage 同标签页共享），工作台按 id 从 history-store 取回。
 */
export function buildHistoryWorkspaceUrl(
  connectionId: string | null,
  sql: string,
  rHistoryId?: string | null,
): string | null {
  const base = buildWorkspaceUrl(connectionId, sql)
  if (!base) return null
  const id = rHistoryId?.trim()
  return id ? `${base}&r=${encodeURIComponent(id)}` : base
}

/** 从工作台 URL 参数解析要回放的 R 历史 id（无/非法 = null） */
export function parseRHistoryParam(raw: string | null): string | null {
  const id = raw?.trim()
  return id || null
}
