import { describe, expect, it } from "vitest"
import { DEFAULT_SPLIT_RATIO, clampSplitRatio } from "../r-workbench"

describe("R 工作台代码/输出分割比例", () => {
  it("默认值落在允许区间内", () => {
    expect(DEFAULT_SPLIT_RATIO).toBeGreaterThanOrEqual(0.35)
    expect(DEFAULT_SPLIT_RATIO).toBeLessThanOrEqual(0.8)
  })

  it("超过边界时夹紧，保证两侧都可见", () => {
    expect(clampSplitRatio(0)).toBe(0.35)
    expect(clampSplitRatio(0.5)).toBe(0.5)
    expect(clampSplitRatio(1)).toBe(0.8)
    expect(clampSplitRatio(-3)).toBe(0.35)
  })

  it("非法输入回退默认比例（拖拽越界或存储损坏都不破坏布局）", () => {
    expect(clampSplitRatio(Number.NaN)).toBe(DEFAULT_SPLIT_RATIO)
    expect(clampSplitRatio(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SPLIT_RATIO)
  })
})
