export interface ValidationResult {
  valid: boolean
  error?: string
  sanitizedSQL?: string
}

const ALLOWED_KEYWORDS = ['SELECT', 'WITH']
const FORBIDDEN_KEYWORDS = [
  'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'INSERT', 'UPDATE',
  'CREATE', 'GRANT', 'REVOKE', 'EXECUTE', 'COPY'
]

export function validateSQL(sql: string): ValidationResult {
  const upperSQL = sql.toUpperCase().trim()

  if (!sql.trim()) {
    return { valid: false, error: 'SQL 不能为空' }
  }

  // The database read-only transaction is the final boundary. This parser
  // remains deliberately conservative so malformed multi-statements fail fast.
  if (sql.includes(';')) {
    return { valid: false, error: '只允许执行一条 SELECT 查询' }
  }

  // 检查是否以 SELECT 或 WITH 开头
  if (!ALLOWED_KEYWORDS.some(kw => upperSQL.startsWith(kw))) {
    return {
      valid: false,
      error: '只允许 SELECT 查询'
    }
  }

  // 检查是否包含禁止的关键词（单词边界匹配，避免误判字段名）
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    if (regex.test(sql)) {
      return {
        valid: false,
        error: `包含禁止的操作: ${keyword}`
      }
    }
  }

  if (/\bINTO\s+(TEMP|UNLOGGED|TABLE)\b/i.test(sql) || /\bFOR\s+(UPDATE|SHARE)\b/i.test(sql)) {
    return { valid: false, error: '查询不能修改或锁定数据' }
  }

  const sanitizedSQL = sql

  // 检查括号匹配
  const openCount = (sanitizedSQL.match(/\(/g) || []).length
  const closeCount = (sanitizedSQL.match(/\)/g) || []).length
  if (openCount !== closeCount) {
    return {
      valid: false,
      error: '括号不匹配'
    }
  }

  return {
    valid: true,
    sanitizedSQL
  }
}
