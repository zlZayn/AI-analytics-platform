/** Build the canonical URL used by pages that send SQL to the workbench. */
export function buildWorkspaceUrl(connectionId: string | null, sql = ""): string | null {
  const connection = connectionId?.trim()
  const query = sql.trim()
  if (!connection || !query) return null
  return `/workspace?connection=${encodeURIComponent(connection)}&sql=${encodeURIComponent(query)}`
}
