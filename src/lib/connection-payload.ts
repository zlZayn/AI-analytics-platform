// 连接表单 → 请求体
// 契约：PUT /api/connections/[id] 只更新请求体中出现的字段，
// 密码留空表示「不修改」，因此空串必须整体省略而不是提交空字符串。

export interface ConnectionFormValues {
  name: string
  description: string
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
}

export function buildConnectionPayload(
  form: ConnectionFormValues,
  editingId: string | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...form }
  if (editingId && form.password === "") delete payload.password
  return payload
}
