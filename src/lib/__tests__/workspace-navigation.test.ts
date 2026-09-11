import { describe, expect, it } from "vitest"

import { buildHistoryWorkspaceUrl, buildWorkspaceUrl, normalizeWorkspaceSql, parseRHistoryParam, workspaceSqlKey } from "../workspace-navigation"

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

describe("buildHistoryWorkspaceUrl", () => {
  it("无回放 id 时与 buildWorkspaceUrl 一致", () => {
    expect(buildHistoryWorkspaceUrl("connection-1", "SELECT 1")).toBe(buildWorkspaceUrl("connection-1", "SELECT 1"))
    expect(buildHistoryWorkspaceUrl("connection-1", "SELECT 1", null)).toBe(buildWorkspaceUrl("connection-1", "SELECT 1"))
  })

  it("带回放 id 时追加 r 参数并编码", () => {
    expect(buildHistoryWorkspaceUrl("connection-1", "SELECT 1", "r-123/456")).toBe(
      "/workspace?connection=connection-1&sql=SELECT%201&r=r-123%2F456",
    )
  })

  it("SQL 缺失时返回 null（回放 id 不能单独成导航）", () => {
    expect(buildHistoryWorkspaceUrl("connection-1", "  ", "r-1")).toBeNull()
  })
})

describe("parseRHistoryParam", () => {
  it("空值与全空白返回 null", () => {
    expect(parseRHistoryParam(null)).toBeNull()
    expect(parseRHistoryParam("  ")).toBeNull()
  })

  it("trim 后返回 id", () => {
    expect(parseRHistoryParam(" r-1 ")).toBe("r-1")
  })
})
