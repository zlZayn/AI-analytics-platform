const MAX_IDENTIFIER_LENGTH = 128

export function quotePostgresIdentifier(value: string): string {
  if (!value) throw new Error("标识符不能为空")
  if (value.length > MAX_IDENTIFIER_LENGTH) throw new Error("标识符过长")
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error("标识符包含非法字符")
  return `"${value.replaceAll('"', '""')}"`
}
