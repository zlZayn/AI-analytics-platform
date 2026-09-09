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
