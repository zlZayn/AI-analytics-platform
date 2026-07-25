import { describe, expect, it } from "vitest"
import { validateSQL } from "../sql-validator"

describe("validateSQL", () => {
  it("accepts a single read query", () => {
    expect(validateSQL("SELECT 1").valid).toBe(true)
    expect(validateSQL("WITH data AS (SELECT 1) SELECT * FROM data").valid).toBe(true)
  })

  it("rejects multi-statements and write/lock clauses", () => {
    expect(validateSQL("SELECT 1; DROP TABLE users").valid).toBe(false)
    expect(validateSQL("SELECT * FROM users FOR UPDATE").valid).toBe(false)
    expect(validateSQL("UPDATE users SET name = 'x'").valid).toBe(false)
  })
})
