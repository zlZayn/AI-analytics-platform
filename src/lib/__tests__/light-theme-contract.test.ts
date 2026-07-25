import { readFileSync } from "node:fs"
import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), "utf8")

function readTsxTree(directory: string): string {
  return readdirSync(resolve(root, directory), { recursive: true })
    .filter((path) => path.toString().endsWith(".tsx"))
    .map((path) => read(`${directory}/${path.toString().replaceAll("\\", "/")}`))
    .join("\n")
}

describe("light-only theme contract", () => {
  it("has no runtime theme switch or dark-mode styles", () => {
    const layout = read("src/app/layout.tsx")
    const sidebar = read("src/components/layout/sidebar.tsx")
    const globalStyles = read("src/app/globals.css")
    const primitives = [
      "src/components/ui/badge.tsx",
      "src/components/ui/button.tsx",
      "src/components/ui/input.tsx",
      "src/components/ui/select.tsx",
      "src/components/ui/tabs.tsx",
    ].map(read)

    expect(layout).not.toContain("analytics-theme")
    expect(layout).not.toContain("prefers-color-scheme: dark")
    expect(sidebar).not.toContain("ThemeToggle")
    expect(globalStyles).not.toMatch(/@custom-variant\s+dark|\.dark\s*\{/)
    expect(primitives.join("\n")).not.toContain("dark:")
  })

  it("keeps static interface colors in global semantic tokens", () => {
    const interfaceSource = readTsxTree("src/app") + readTsxTree("src/components")
    const staticUiSource = read("src/components/ui/button.tsx")

    expect(interfaceSource).not.toMatch(/#[\da-f]{3,8}/i)
    expect(interfaceSource).not.toMatch(
      /(?:bg|border|text)-(?:amber|black|blue|emerald|green|red|rose|yellow|white)-?[\d/]*/
    )
    expect(staticUiSource).not.toContain("color-mix(")
  })
})
