/**
 * R 桥接：SemanticDataset ↔ R 代码的纯函数层。
 * 无副作用、无外部依赖，可直接单元测试。
 * 职责：值格式化、data.frame 代码生成、R 模板生成、CSV 导出。
 */

import type { SemanticDataset, SemanticType } from "@/types/session"

/** 语义类型 → R 类型说明（用于模板注释与类型转换） */
const TYPE_COMMENT: Record<SemanticType, string> = {
  numeric: "numeric",
  temporal: "Date",
  categorical: "factor",
  boolean: "logical",
  identifier: "character",
  text: "character",
  unknown: "character",
}

/** 列名转义：非简单标识符（含中文/空格/特殊字符）包反引号 */
export function escapeRName(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) return name
  return `\`${name}\``
}

/** 单个值 → R 字面量代码 */
export function formatRValue(val: unknown, semanticType: SemanticType): string {
  if (val === null || val === undefined) return "NA"

  if (semanticType === "numeric") {
    if (typeof val === "number") {
      if (Number.isNaN(val)) return "NaN"
      if (val === Infinity) return "Inf"
      if (val === -Infinity) return "-Inf"
      return String(val)
    }
    // 科学计数法字符串原样保留（R 可正确解析）；其余尝试转数字
    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(String(val))) return String(val)
    const n = Number(val)
    return Number.isNaN(n) ? `"${escapeString(String(val))}"` : String(n)
  }

  if (semanticType === "boolean") {
    const v = val === true || val === "true" || val === 1 || val === "1"
    return v ? "TRUE" : "FALSE"
  }

  if (semanticType === "temporal") {
    const s = String(val)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `as.Date("${s}")`
    return `as.POSIXct("${s}")`
  }

  // unknown：先尝试数字转换，失败则字符串字面量（兜底）
  if (semanticType === "unknown" && typeof val === "string") {
    const n = Number(val)
    if (!Number.isNaN(n) && String(val).trim() !== "") {
      if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(val)) return val
      return String(n)
    }
  }

  // categorical/text/identifier/unknown 其余：字符串字面量（转义引号与反斜杠）
  return `"${escapeString(String(val))}"`
}

function escapeString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/** 数据集 → R data.frame 构建代码（列向量形式） */
export function buildDataFrameCode(dataset: SemanticDataset): string {
  const colCode = dataset.columns.map((col) => {
    const values = dataset.rows.map((row) => formatRValue(row[col.name], col.semanticType))
    return `  ${escapeRName(col.name)} = c(${values.join(", ")})`
  })
  return `df <- data.frame(\n${colCode.join(",\n")}\n)`
}

/**
 * R 模板：可独立运行的完整分析脚本。
 * - 预置 webr::canvas() 与 dev.off()（ggplot2 输出陷阱显式化）
 * - 按语义类型自动选择绘图骨架
 */
export function generateRTemplate(dataset: SemanticDataset): string {
  const lines: string[] = []
  const columns = dataset.columns

  lines.push("# 数据加载")
  lines.push(buildDataFrameCode(dataset))
  lines.push("")
  lines.push("# 加载 R 包（首次使用需联网下载）")
  lines.push("library(dplyr)")
  lines.push("library(ggplot2)")
  lines.push("")
  lines.push("# WebR 图形设备（必须）：捕获 ggplot2 输出")
  lines.push("webr::canvas()")
  lines.push("")
  lines.push("# 数据概览")
  lines.push("summary(df)")
  lines.push("")
  lines.push("# 可视化示例")

  const numericCols = columns.filter((c) => c.semanticType === "numeric")
  const catCols = columns.filter((c) => c.semanticType === "categorical" || c.semanticType === "boolean")
  const temporalCols = columns.filter((c) => c.semanticType === "temporal")

  if (temporalCols.length > 0 && numericCols.length > 0) {
    const x = escapeRName(temporalCols[0].name)
    const y = escapeRName(numericCols[0].name)
    lines.push(`ggplot(df, aes(x = ${x}, y = ${y})) +`)
    lines.push(`  geom_line() +`)
    lines.push(`  geom_point() +`)
    lines.push(`  theme_minimal()`)
  } else if (numericCols.length > 0 && catCols.length > 0) {
    const x = escapeRName(catCols[0].name)
    const y = escapeRName(numericCols[0].name)
    lines.push(`ggplot(df, aes(x = ${x}, y = ${y})) +`)
    lines.push(`  geom_boxplot() +`)
    lines.push(`  theme_minimal()`)
  } else if (numericCols.length > 0) {
    const x = escapeRName(numericCols[0].name)
    lines.push(`ggplot(df, aes(x = ${x})) +`)
    lines.push(`  geom_histogram(bins = 30) +`)
    lines.push(`  theme_minimal()`)
  } else if (catCols.length > 0) {
    const x = escapeRName(catCols[0].name)
    lines.push(`ggplot(df, aes(x = ${x})) +`)
    lines.push(`  geom_bar() +`)
    lines.push(`  theme_minimal()`)
  } else {
    lines.push("plot(df)")
  }

  lines.push("")
  lines.push("# 关闭图形设备：刷新缓冲区，将图像发送到主线程")
  lines.push("dev.off()")

  return lines.join("\n")
}

/** 数据集 → CSV 字符串（UTF-8 BOM，兼容 Excel 中文） */
export function exportCSV(dataset: SemanticDataset): string {
  const headers = dataset.columns.map((c) => c.name).join(",")
  const rows = dataset.rows.map((row) =>
    dataset.columns
      .map((col) => {
        const val = row[col.name]
        if (val === null || val === undefined) return ""
        // 布尔值规范化为 R/Excel 友好形式
        if (col.semanticType === "boolean") {
          return val === true || val === "true" || val === 1 || val === "1" ? "TRUE" : "FALSE"
        }
        const str = String(val)
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(",")
  )
  return `\uFEFF${headers}\n${rows.join("\n")}`
}

/**
 * 数据集 → 仅行数据代码（预留：大数据量注入优化用）。
 * 与小数据路径 buildDataFrameCode 等价，但值直接取自 rows。
 */
export function datasetToRowsCode(dataset: SemanticDataset): string {
  return buildDataFrameCode(dataset)
}

/** R 列类型说明（模板/UI 展示用） */
export function describeColumns(dataset: SemanticDataset): string {
  return dataset.columns
    .map((c) => `- ${c.name} (${TYPE_COMMENT[c.semanticType] ?? "character"})`)
    .join("\n")
}