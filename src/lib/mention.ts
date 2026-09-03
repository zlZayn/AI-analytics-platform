/**
 * AI @ 提及的纯文本逻辑：在 "@表名" 语法与 schema 表之间做解析与替换。
 * 无 React 依赖，可直接单元测试。
 */

export interface MentionTable {
  name: string
  columns: { name: string }[]
}

/** 取文本中"正在输入的提及词"：最后一个以 @ 开头的词；无则 null。 */
export function extractPendingMention(text: string): string | null {
  const words = text.split(/\s+/)
  const last = words[words.length - 1] ?? ""
  if (!last.startsWith("@")) return null
  return last.slice(1)
}

/** 把文本中最后一个 @ 词（含裸 @）替换为 @name；@name 后跟一个空格（如有尾随文本则保持）。 */
export function replaceMention(text: string, name: string): string {
  const re = /@[^\s@]*/g
  let last: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) last = m
  if (!last) return `${text}@${name} `
  const head = text.slice(0, last.index)
  const tail = text.slice(last.index + last[0].length)
  return `${head}@${name} ${tail.replace(/^\s+/, "")}`
}

/** 从文本中提取全部 @表名 提及（去重，忽略裸 @）。 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@([A-Za-z_][A-Za-z0-9_.]*)/g) ?? []
  const names = matches.map((m) => m.slice(1)).filter(Boolean)
  return [...new Set(names)]
}

/** 按提及词过滤表列表（大小写不敏感子串匹配）。 */
export function filterTables<T extends MentionTable>(tables: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return tables
  return tables.filter((t) => t.name.toLowerCase().includes(q))
}