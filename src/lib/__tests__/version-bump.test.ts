import { execFileSync } from "node:child_process"
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const scriptPath = join(process.cwd(), "scripts", "bump-version.mjs")
const packagePath = join(process.cwd(), "package.json")

function runBump(argument: string, version = "1.25.3") {
  const dir = mkdtempSync(join(tmpdir(), "bump-version-"))
  copyFileSync(packagePath, join(dir, "package.json"))
  const target = join(dir, "package.json")
  const original = readFileSync(target, "utf8")
  writeFileSync(target, original.replace(/"version": "\d+\.\d+\.\d+"/, `"version": "${version}"`), "utf8")
  const stdout = execFileSync(process.execPath, [scriptPath, argument], { cwd: dir, encoding: "utf8" })
  const updated = readFileSync(target, "utf8")
  return { stdout, version: JSON.parse(updated).version, updated }
}

describe("bump-version 脚本", () => {
  it("按语义递增并把低位归零", () => {
    expect(runBump("major").version).toBe("2.0.0")
    expect(runBump("minor").version).toBe("1.26.0")
    expect(runBump("patch").version).toBe("1.25.4")
  })

  it("显式 X.Y.Z 原样采用", () => {
    expect(runBump("3.1.4").version).toBe("3.1.4")
  })

  it("只改 version 一行，其余字节不动", () => {
    const { updated } = runBump("patch")
    const original = readFileSync(packagePath, "utf8")
    expect(updated.split("\n").length).toBe(original.split("\n").length)
    expect(updated).toContain("ai-analytics-platform")
  })

  it("非法参数以非零码退出并打印用法", () => {
    expect(() => runBump("hotfix")).toThrow()
  })
})
