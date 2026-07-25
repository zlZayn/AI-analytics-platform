import { describe, expect, it, vi } from "vitest"
import { executeCancelable, QueryCancelledError } from "../query-cancellation"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("executeCancelable", () => {
  it("does not start an operation when the request is already aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    const start = vi.fn(async () => 1)
    const cancel = vi.fn(async () => undefined)

    await expect(executeCancelable(start, cancel, controller.signal)).rejects.toBeInstanceOf(QueryCancelledError)
    expect(start).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
  })

  it("cancels once and waits for the database operation to settle", async () => {
    const controller = new AbortController()
    let rejectQuery!: (error: Error) => void
    const operation = new Promise<number>((_, reject) => { rejectQuery = reject })
    const cancel = vi.fn(async () => undefined)
    let settled = false

    const execution = executeCancelable(() => operation, cancel, controller.signal)
      .finally(() => { settled = true })
    controller.abort()
    controller.abort()
    await Promise.resolve()

    expect(cancel).toHaveBeenCalledOnce()
    expect(settled).toBe(false)

    rejectQuery(new Error("canceling statement due to user request"))
    await expect(execution).rejects.toBeInstanceOf(QueryCancelledError)
    expect(settled).toBe(true)
  })

  it("passes the route request signal into the query engine", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/query/route.ts"), "utf8")
    const engine = readFileSync(resolve(process.cwd(), "src/lib/query-engine.ts"), "utf8")

    expect(route).toMatch(/executeQuery\([\s\S]*?request\.signal/)
    expect(engine).toMatch(/signal\?: AbortSignal/)
    expect(engine).toContain("pg_cancel_backend")
  })
})
