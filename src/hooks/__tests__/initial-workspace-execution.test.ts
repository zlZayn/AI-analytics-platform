import { describe, expect, it } from "vitest"

import { shouldStartCompiledExecution } from "../useSession"

describe("initial workspace execution", () => {
  it("does not start the same compiled SQL object twice", () => {
    const compiled = { sql: "SELECT 1", params: [] }
    expect(shouldStartCompiledExecution(null, compiled)).toBe(true)
    expect(shouldStartCompiledExecution(compiled, compiled)).toBe(false)
    expect(shouldStartCompiledExecution(compiled, { sql: "SELECT 1", params: [] })).toBe(true)
  })
})
