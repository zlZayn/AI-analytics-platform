import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function routeFiles(): string[] {
  const root = resolve(process.cwd(), "src/app/api")
  return readdirSync(root, { recursive: true })
    .map(String)
    .filter((path) => path.endsWith("route.ts"))
    .map((path) => resolve(root, path))
}

describe("API route response contract", () => {
  it("uses the shared response helpers for every route response", () => {
    for (const file of routeFiles()) {
      const source = readFileSync(file, "utf8")
      expect(source, file).not.toContain("NextResponse.json")
      expect(source, file).not.toMatch(/success:\s*false/)
      expect(source, file).not.toContain("errorInfo")
    }
  })

  it("uses the shared discriminated response type in client callers", () => {
    const roots = ["src/app", "src/components"]
    const source = roots.flatMap((root) => readdirSync(resolve(process.cwd(), root), { recursive: true })
      .map(String)
      .filter((path) => /\.tsx?$/.test(path))
      .map((path) => readFileSync(resolve(process.cwd(), root, path), "utf8")))
      .join("\n")

    expect(source).not.toMatch(/fetchApi<\{\s*success:\s*boolean/)
    expect(source).not.toMatch(/(?<!fetchApi)\bfetch\(/)
  })
})
