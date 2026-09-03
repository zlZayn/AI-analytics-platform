import { describe, expect, it } from "vitest"
import {
  buildDataFrameCode,
  datasetToRowsCode,
  escapeRName,
  exportCSV,
  formatRValue,
  generateRTemplate,
} from "@/lib/r-bridge"
import type { SemanticDataset } from "@/types/session"

function makeDataset(overrides: Partial<SemanticDataset> = {}): SemanticDataset {
  return {
    columns: [
      { name: "mpg", type: "float8", semanticType: "numeric" },
      { name: "cyl", type: "int4", semanticType: "numeric" },
      { name: "am", type: "bool", semanticType: "boolean" },
      { name: "day", type: "date", semanticType: "temporal" },
      { name: "region", type: "varchar", semanticType: "categorical" },
    ],
    rows: [
      { mpg: 21, cyl: 6, am: true, day: "2026-01-01", region: "华东" },
      { mpg: 22.8, cyl: 4, am: false, day: "2026-01-02", region: "华南" },
      { mpg: null, cyl: 8, am: true, day: null, region: "华北" },
    ],
    rowCount: 3,
    executionTimeMs: 10,
    returnedRowCount: 3,
    truncated: false,
    rowLimit: 5000,
    ...overrides,
  }
}

describe("escapeRName", () => {
  it("keeps simple identifiers as-is", () => {
    expect(escapeRName("sales")).toBe("sales")
    expect(escapeRName("sales_2026")).toBe("sales_2026")
  })

  it("wraps Chinese or special names in backticks", () => {
    expect(escapeRName("订单金额")).toBe("`订单金额`")
    expect(escapeRName("order id")).toBe("`order id`")
  })
})

describe("formatRValue", () => {
  it("maps null to NA", () => {
    expect(formatRValue(null, "numeric")).toBe("NA")
    expect(formatRValue(undefined, "categorical")).toBe("NA")
  })

  it("formats numeric values including specials", () => {
    expect(formatRValue(21, "numeric")).toBe("21")
    expect(formatRValue(22.8, "numeric")).toBe("22.8")
    expect(formatRValue(Infinity, "numeric")).toBe("Inf")
    expect(formatRValue(-Infinity, "numeric")).toBe("-Inf")
    expect(formatRValue(Number.NaN, "numeric")).toBe("NaN")
  })

  it("coerces numeric strings and falls back to quoted literal", () => {
    expect(formatRValue("42", "numeric")).toBe("42")
    expect(formatRValue("1.23e-5", "numeric")).toBe("1.23e-5")
    expect(formatRValue("abc", "numeric")).toBe('"abc"')
  })

  it("maps booleans to TRUE/FALSE", () => {
    expect(formatRValue(true, "boolean")).toBe("TRUE")
    expect(formatRValue(false, "boolean")).toBe("FALSE")
    expect(formatRValue("1", "boolean")).toBe("TRUE")
    expect(formatRValue(0, "boolean")).toBe("FALSE")
  })

  it("formats temporal values as Date or POSIXct", () => {
    expect(formatRValue("2026-01-01", "temporal")).toBe('as.Date("2026-01-01")')
    expect(formatRValue("2026-01-01T10:00:00", "temporal")).toBe('as.POSIXct("2026-01-01T10:00:00")')
  })

  it("quotes strings and escapes quotes/backslashes", () => {
    expect(formatRValue('say "hi"', "text")).toBe('"say \\"hi\\""')
    expect(formatRValue("a\\b", "categorical")).toBe('"a\\\\b"')
  })

  it("falls back for unknown type: numeric strings convert, others stay quoted", () => {
    expect(formatRValue("3.14", "unknown")).toBe("3.14")
    expect(formatRValue("2026", "unknown")).toBe("2026")
    expect(formatRValue("not-a-number", "unknown")).toBe('"not-a-number"')
  })
})

describe("buildDataFrameCode", () => {
  it("generates a data.frame with NA for nulls", () => {
    const code = buildDataFrameCode(makeDataset())
    expect(code).toContain("df <- data.frame(")
    expect(code).toContain("mpg = c(21, 22.8, NA)")
    expect(code).toContain("am = c(TRUE, FALSE, TRUE)")
    expect(code).toContain('day = c(as.Date("2026-01-01"), as.Date("2026-01-02"), NA)')
    expect(code).toContain('region = c("华东", "华南", "华北")')
  })

  it("escapes Chinese column names", () => {
    const ds = makeDataset({ columns: [{ name: "订单金额", type: "float8", semanticType: "numeric" }], rows: [{ "订单金额": 100 }] })
    expect(buildDataFrameCode(ds)).toContain("`订单金额` = c(100)")
  })

  it("handles empty dataset", () => {
    const ds = makeDataset({ rows: [] })
    expect(buildDataFrameCode(ds)).toContain("df <- data.frame(")
  })
})

describe("generateRTemplate", () => {
  it("includes canvas, dev.off, libraries", () => {
    const tpl = generateRTemplate(makeDataset())
    expect(tpl).toContain("webr::canvas()")
    expect(tpl).toContain("dev.off()")
    expect(tpl).toContain("library(dplyr)")
    expect(tpl).toContain("library(ggplot2)")
  })

  it("picks boxplot for numeric + categorical", () => {
    const ds = makeDataset({
      columns: [
        { name: "sales", type: "float8", semanticType: "numeric" },
        { name: "region", type: "varchar", semanticType: "categorical" },
      ],
      rows: [{ sales: 1, region: "A" }],
    })
    expect(generateRTemplate(ds)).toContain("geom_boxplot()")
  })

  it("picks histogram for numeric only", () => {
    const ds = makeDataset({
      columns: [{ name: "sales", type: "float8", semanticType: "numeric" }],
      rows: [{ sales: 1 }],
    })
    expect(generateRTemplate(ds)).toContain("geom_histogram(bins = 30)")
  })

  it("picks line chart when temporal + numeric present", () => {
    const ds = makeDataset({
      columns: [
        { name: "day", type: "date", semanticType: "temporal" },
        { name: "sales", type: "float8", semanticType: "numeric" },
      ],
      rows: [{ day: "2026-01-01", sales: 1 }],
    })
    expect(generateRTemplate(ds)).toContain("geom_line()")
  })

  it("picks bar chart for categorical only", () => {
    const ds = makeDataset({
      columns: [{ name: "region", type: "varchar", semanticType: "categorical" }],
      rows: [{ region: "A" }],
    })
    expect(generateRTemplate(ds)).toContain("geom_bar()")
  })
})

describe("exportCSV", () => {
  it("starts with UTF-8 BOM and escapes special values", () => {
    const ds = makeDataset({
      rows: [{ mpg: 21, cyl: 6, am: true, day: "2026-01-01", region: '华,东"引号' }],
    })
    const csv = exportCSV(ds)
    expect(csv.startsWith("\uFEFF")).toBe(true)
    expect(csv).toContain('"华,东""引号"')
  })

  it("emits empty cell for null", () => {
    const csv = exportCSV(makeDataset())
    // 第三行：mpg=null, cyl=8, am=TRUE, day=null, region=华北 → ,8,TRUE,,华北
    expect(csv).toContain(",8,TRUE,,华北")
  })

  it("header row uses column names", () => {
    const csv = exportCSV(makeDataset())
    expect(csv).toContain("mpg,cyl,am,day,region")
  })
})

describe("datasetToRowsCode", () => {
  it("produces equivalent code to buildDataFrameCode", () => {
    const ds = makeDataset()
    expect(datasetToRowsCode(ds)).toBe(buildDataFrameCode(ds))
  })
})