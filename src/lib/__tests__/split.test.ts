import { describe, expect, it } from "vitest"
import { SPLIT_PRESETS, SPLIT_STORAGE_PREFIX, clampRatio, readStoredRatio, writeStoredRatio } from "../split"

const BOUNDS = { min: 0.2, max: 0.8 }

function fakeStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    entries,
  }
}

describe("分割比例夹紧", () => {
  it("越界夹紧，非法值回退默认", () => {
    expect(clampRatio(0.5, 0.6, BOUNDS)).toBe(0.5)
    expect(clampRatio(0, 0.6, BOUNDS)).toBe(0.2)
    expect(clampRatio(1, 0.6, BOUNDS)).toBe(0.8)
    expect(clampRatio(Number.NaN, 0.6, BOUNDS)).toBe(0.6)
  })
})

describe("分割预设", () => {
  const presets = Object.values(SPLIT_PRESETS)

  it("三处分割的存储 key 互不相同（否则会互相覆盖记忆）", () => {
    expect(new Set(presets.map((preset) => preset.key)).size).toBe(presets.length)
  })

  it("默认比例落在边界内，边界本身有效且两侧都留有余量", () => {
    for (const preset of presets) {
      expect(preset.bounds.min).toBeGreaterThan(0)
      expect(preset.bounds.max).toBeLessThan(1)
      expect(preset.bounds.min).toBeLessThan(preset.bounds.max)
      expect(preset.defaultRatio).toBeGreaterThanOrEqual(preset.bounds.min)
      expect(preset.defaultRatio).toBeLessThanOrEqual(preset.bounds.max)
    }
  })
})

describe("分割比例持久化", () => {
  it("读：无记录用默认，损坏记录回退默认，越界记录夹紧", () => {
    expect(readStoredRatio("k", 0.6, BOUNDS, fakeStorage())).toBe(0.6)
    expect(readStoredRatio("k", 0.6, BOUNDS, fakeStorage({ [SPLIT_STORAGE_PREFIX + "k"]: "abc" }))).toBe(0.6)
    expect(readStoredRatio("k", 0.6, BOUNDS, fakeStorage({ [SPLIT_STORAGE_PREFIX + "k"]: "0.95" }))).toBe(0.8)
    expect(readStoredRatio("k", 0.6, BOUNDS, fakeStorage({ [SPLIT_STORAGE_PREFIX + "k"]: "0.42" }))).toBe(0.42)
  })

  it("写：带统一前缀；存储不可用时静默", () => {
    const storage = fakeStorage()
    writeStoredRatio("k", 0.55, storage)
    expect(storage.entries.get(SPLIT_STORAGE_PREFIX + "k")).toBe("0.55")

    expect(() => readStoredRatio("k", 0.6, BOUNDS, null)).not.toThrow()
    expect(() => writeStoredRatio("k", 0.6, null)).not.toThrow()
  })
})
