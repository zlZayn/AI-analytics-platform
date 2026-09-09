import { describe, expect, it } from "vitest"

import { buildWorkspaceUrl, normalizeWorkspaceSql, workspaceSqlKey } from "../workspace-navigation"

describe("buildWorkspaceUrl", () => {
  it("returns null when the connection or SQL is missing", () => {
    expect(buildWorkspaceUrl(null, "SELECT 1")).toBeNull()
    expect(buildWorkspaceUrl("connection-1", "   ")).toBeNull()
  })

  it("trims SQL and encodes connection and special characters", () => {
    expect(buildWorkspaceUrl("连接/1", "  SELECT '&' AS 名称  ")).toBe(
      "/workspace?connection=%E8%BF%9E%E6%8E%A5%2F1&sql=SELECT%20'%26'%20AS%20%E5%90%8D%E7%A7%B0",
    )
  })

  it("normalizes Windows line endings before navigation", () => {
    expect(normalizeWorkspaceSql("  SELECT 1\r\nFROM dual\r  ")).toBe("SELECT 1\nFROM dual")
    expect(buildWorkspaceUrl("connection-1", "SELECT 1\r\nFROM dual")).toBe(
      "/workspace?connection=connection-1&sql=SELECT%201%0AFROM%20dual",
    )
  })

  it("creates a stable key for one-time initial SQL application", () => {
    const key = workspaceSqlKey(" connection-1 ", " SELECT 1 ")
    expect(key).toBe("connection-1\u0000SELECT 1")
    expect(workspaceSqlKey("connection-1", "   ")).toBeNull()
  })
})
