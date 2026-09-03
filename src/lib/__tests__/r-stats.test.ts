import { describe, expect, it } from "vitest"
import {
  buildStatTestCode,
  parseStatTestOutput,
  summarizeStatTest,
  STAT_SAMPLE_ROWS,
  type StatTestRequest,
} from "@/lib/r-stats"
import type { SemanticDataset } from "@/types/session"

const dataset: SemanticDataset = {
  columns: [
    { name: "sales", type: "float8", semanticType: "numeric" },
    { name: "region", type: "varchar", semanticType: "categorical" },
  ],
  rows: [
    { sales: 1, region: "A" },
    { sales: 2, region: "B" },
    { sales: null, region: "A" },
  ],
  rowCount: 3,
  executionTimeMs: 5,
  returnedRowCount: 3,
  truncated: false,
  rowLimit: 5000,
}

describe("buildStatTestCode", () => {
  it("builds a ttest template from two numeric columns", () => {
    const req: StatTestRequest = { kind: "ttest", x: "sales", y: "region", hypothesis: "h" }
    const code = buildStatTestCode(dataset, req)
    expect(code).toContain("x <- c(1, 2, NA)")
    expect(code).toContain('y <- c("A", "B", "A")')
    expect(code).toContain("t.test(x, y)")
    expect(code).toContain("P_VALUE=")
  })

  it("builds cor and chisq templates", () => {
    const cor = buildStatTestCode(dataset, { kind: "cor", x: "sales", y: "region", hypothesis: "h" })
    expect(cor).toContain("cor.test(x, y")
    const chi = buildStatTestCode(dataset, { kind: "chisq", x: "sales", y: "region", hypothesis: "h" })
    expect(chi).toContain("chisq.test(x, y)")
  })

  it("throws when a column is missing", () => {
    expect(() =>
      buildStatTestCode(dataset, { kind: "ttest", x: "nope", y: "region", hypothesis: "h" })
    ).toThrow("统计检验列不存在")
  })

  it("caps rows at the sample limit", () => {
    const big: SemanticDataset = {
      ...dataset,
      rows: Array.from({ length: STAT_SAMPLE_ROWS + 100 }, (_, i) => ({ sales: i, region: "A" })),
      rowCount: STAT_SAMPLE_ROWS + 100,
      returnedRowCount: STAT_SAMPLE_ROWS + 100,
    }
    const code = buildStatTestCode(big, { kind: "cor", x: "sales", y: "region", hypothesis: "h" })
    expect(code.split("NA").length).toBe(1) // 无 NA，行数 = STAT_SAMPLE_ROWS
    const xPart = code.split("\n")[0]
    const values = xPart.match(/c\((.+)\)/)![1].split(", ").length
    expect(values).toBe(STAT_SAMPLE_ROWS)
  })
})

describe("parseStatTestOutput", () => {
  it("parses the fixed-format line", () => {
    expect(parseStatTestOutput("P_VALUE=0.04464|STAT=-2.0515|DF=57.79|N=100", "ttest")).toEqual({
      kind: "ttest",
      pValue: 0.04464,
      statistic: -2.0515,
      detail: "P_VALUE=0.04464|STAT=-2.0515|DF=57.79|N=100",
      sampleSize: 100,
    })
  })

  it("returns null for unparseable output", () => {
    expect(parseStatTestOutput("Error in t.test(x, y)", "ttest")).toBeNull()
  })
})

describe("summarizeStatTest", () => {
  it("states significance for p < 0.05", () => {
    expect(
      summarizeStatTest({ kind: "ttest", pValue: 0.03, statistic: 2.3, detail: "", sampleSize: 50 })
    ).toContain("存在显著差异")
  })

  it("states no significance for p >= 0.05", () => {
    expect(
      summarizeStatTest({ kind: "cor", pValue: 0.2, statistic: 0.1, detail: "", sampleSize: 50 })
    ).toContain("未发现显著相关")
    expect(summarizeStatTest({ kind: "chisq", pValue: 0.6, statistic: 1.2, detail: "", sampleSize: 50 })).toContain(
      "未发现显著关联"
    )
  })
})