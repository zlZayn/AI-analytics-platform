import { formatRValue } from "@/lib/r-bridge"
import type { SemanticDataset } from "@/types/session"

/**
 * WebR 黑盒统计引擎（蓝图阶段 3）：AI 提议 → 固定模板执行 → 业务语言结论。
 * 只使用 R base（stats 包），不装额外包；代码为固定模板拼接，AI 不直接生成 R。
 */

export type StatTestKind = "ttest" | "cor" | "chisq"

export interface StatTestRequest {
  kind: StatTestKind
  /** 第一列（querySpec/displayConfig 输出别名） */
  x: string
  /** 第二列 */
  y: string
  /** 业务假设描述（AI 提供，展示给用户） */
  hypothesis: string
}

export interface StatTestResult {
  kind: StatTestKind
  pValue: number
  statistic: number
  detail: string
  sampleSize: number
}

/** 统计检验最多使用的行数（采样上限，防止大结果集拖慢 WebR） */
export const STAT_SAMPLE_ROWS = 1000

/** 构建统计检验 R 代码：x/y 列向量 + 固定模板（输出一行机器可读结果）。 */
export function buildStatTestCode(dataset: SemanticDataset, req: StatTestRequest): string {
  const colX = dataset.columns.find((c) => c.name === req.x)
  const colY = dataset.columns.find((c) => c.name === req.y)
  if (!colX || !colY) throw new Error(`统计检验列不存在: ${req.x} / ${req.y}`)
  const rows = dataset.rows.slice(0, STAT_SAMPLE_ROWS)
  const xVec = rows.map((r) => formatRValue(r[req.x], colX.semanticType)).join(", ")
  const yVec = rows.map((r) => formatRValue(r[req.y], colY.semanticType)).join(", ")
  const body =
    req.kind === "ttest"
      ? 'res <- t.test(x, y)\ncat(sprintf("P_VALUE=%.6g|STAT=%.4g|DF=%.2f|N=%d", res$p.value, res$statistic, res$parameter, length(x)))'
      : req.kind === "cor"
        ? 'res <- cor.test(x, y, method = "pearson")\ncat(sprintf("P_VALUE=%.6g|STAT=%.4g|DF=%.2f|N=%d", res$p.value, res$statistic, res$parameter, length(x)))'
        : 'res <- chisq.test(x, y)\ncat(sprintf("P_VALUE=%.6g|STAT=%.4g|DF=%.2f|N=%d", res$p.value, res$statistic, res$parameter, length(x)))'
  return `x <- c(${xVec})\ny <- c(${yVec})\n${body}`
}

/** 解析固定模板输出（P_VALUE=…|STAT=…|DF=…|N=…）。 */
export function parseStatTestOutput(stdout: string, kind: StatTestKind): StatTestResult | null {
  const p = stdout.match(/P_VALUE=([\d.eE+-]+)/)
  const s = stdout.match(/STAT=([\d.eE+-]+)/)
  const n = stdout.match(/N=(\d+)/)
  if (!p || !s) return null
  const pValue = Number(p[1])
  const statistic = Number(s[1])
  if (!Number.isFinite(pValue) || !Number.isFinite(statistic)) return null
  const sampleSize = n ? Number(n[1]) : 0
  return {
    kind,
    pValue,
    statistic,
    detail: stdout.trim(),
    sampleSize,
  }
}

function formatP(p: number): string {
  return p < 0.001 ? "<0.001" : p.toFixed(4)
}

/** 把统计结果翻译成业务语言（固定规则，无 LLM）。 */
export function summarizeStatTest(result: StatTestResult): string {
  const sig = result.pValue < 0.05
  const p = formatP(result.pValue)
  switch (result.kind) {
    case "ttest":
      return sig
        ? `两组存在显著差异（t=${result.statistic.toFixed(3)}, p=${p}）`
        : `未发现显著差异（t=${result.statistic.toFixed(3)}, p=${p}）`
    case "cor":
      return sig
        ? `存在显著相关（r=${result.statistic.toFixed(3)}, p=${p}）`
        : `未发现显著相关（r=${result.statistic.toFixed(3)}, p=${p}）`
    case "chisq":
      return sig
        ? `类别分布存在显著关联（χ²=${result.statistic.toFixed(3)}, p=${p}）`
        : `未发现显著关联（χ²=${result.statistic.toFixed(3)}, p=${p}）`
  }
}