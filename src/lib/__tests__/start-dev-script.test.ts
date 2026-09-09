import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const script = readFileSync(join(process.cwd(), "Start Dev.cmd"), "utf8")

describe("Start Dev launcher", () => {
  it("restarts an existing server after rebuilding stale source", () => {
    expect(script).toMatch(/set "RESTART_AFTER_BUILD=0"/i)
    expect(script).toMatch(/:build[\s\S]*?set "RESTART_AFTER_BUILD=1"[\s\S]*?call npm run build/i)
    expect(script).toMatch(/if defined SRV_PID \([\s\S]*?if "%RESTART_AFTER_BUILD%"=="1"[\s\S]*?taskkill \/PID !SRV_PID! \/F/i)
  })

  it("passes the port directly to Next instead of through npm script forwarding", () => {
    expect(script).toMatch(/node_modules\\\.bin\\next\.cmd dev -p %PORT%/i)
    expect(script).toMatch(/node_modules\\\.bin\\next\.cmd start -p %PORT%/i)
    expect(script).not.toMatch(/npm run (?:dev|start) -- -p %PORT%/i)
  })
})
