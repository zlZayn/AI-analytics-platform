import { describe, expect, it } from "vitest"
import { calculateVirtualWindow } from "../table-virtualization"

describe("calculateVirtualWindow", () => {
  it("renders the visible rows plus bounded overscan", () => {
    expect(calculateVirtualWindow(5000, 320, 32, 0, 4)).toEqual({
      start: 0,
      end: 14,
      paddingTop: 0,
      paddingBottom: 159552,
    })
  })

  it("clamps the final window and handles empty data", () => {
    expect(calculateVirtualWindow(100, 320, 32, 99999, 4)).toEqual({
      start: 86,
      end: 100,
      paddingTop: 2752,
      paddingBottom: 0,
    })
    expect(calculateVirtualWindow(0, 320, 32, 0, 4)).toEqual({ start: 0, end: 0, paddingTop: 0, paddingBottom: 0 })
  })
})
