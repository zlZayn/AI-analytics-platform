import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ROutputItem } from "@/lib/webr-client"

// 内容区是「代码/输出两段 + 一条分割条」的容器：本测试只断言它把 props 原样下传、
// 且纵向比例由本组件按 rWorkbench 预设持有（换成别的 key 就会与面板其它分割串台）。
const seen = vi.hoisted(() => ({
  editor: null as null | { value: string; onChange: (v: string) => void; onRun: () => void },
  output: null as null | { items: ROutputItem[]; images: { length: number }; busy: boolean },
  splitArgs: [] as unknown[][],
}))

vi.mock("../r-workbench-editor", () => ({
  RWorkbenchEditor: (props: NonNullable<(typeof seen)["editor"]>) => {
    seen.editor = props
    return <div data-testid="r-editor" />
  },
}))

vi.mock("../r-workbench-output", () => ({
  RWorkbenchOutput: (props: NonNullable<(typeof seen)["output"]>) => {
    seen.output = props
    return <div data-testid="r-output" />
  },
}))

vi.mock("@/hooks/useSplitRatio", () => ({
  useSplitRatio: (...args: unknown[]) => {
    seen.splitArgs.push(args)
    return {
      ratio: 0.42,
      preview: vi.fn(),
      commit: vi.fn(),
      reset: vi.fn(),
    }
  },
}))

import { RWorkbenchBody } from "../r-workbench-body"
import { SPLIT_PRESETS } from "@/lib/split"

const items: ROutputItem[] = [{ id: 1, type: "stdout", data: "[1] 42" }]
const images = [{ length: 0 }] as unknown as ImageBitmap[]

function makeProps(over: Partial<React.ComponentProps<typeof RWorkbenchBody>> = {}) {
  return {
    code: "print(42)",
    onCodeChange: vi.fn(),
    onRun: vi.fn(),
    items,
    images,
    busy: false,
    ...over,
  }
}

async function render(props: React.ComponentProps<typeof RWorkbenchBody>) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<RWorkbenchBody {...props} />)
  })
  return { container, root }
}

describe("RWorkbenchBody", () => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  beforeEach(() => {
    seen.editor = null
    seen.output = null
    seen.splitArgs.length = 0
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it("代码与输出 props 原样下传，不因抽取而改名或丢项", async () => {
    await render(makeProps())
    expect(seen.editor?.value).toBe("print(42)")
    expect(seen.output?.items).toBe(items)
    expect(seen.output?.images).toBe(images)
    expect(seen.output?.busy).toBe(false)
  })

  it("编辑器草稿经 onCodeChange 回传给父，本组件不持有代码", async () => {
    const props = makeProps()
    await render(props)
    await act(async () => {
      seen.editor?.onChange("ggplot(df)")
    })
    expect(props.onCodeChange).toHaveBeenCalledWith("ggplot(df)")
  })

  it("运行只在编辑器事件里转调 onRun，本组件不碰执行", async () => {
    const props = makeProps()
    await render(props)
    await act(async () => {
      seen.editor?.onRun()
    })
    expect(props.onRun).toHaveBeenCalledTimes(1)
  })

  it("纵向比例按 rWorkbench 预设读取（key / 默认值 / 上下限）", async () => {
    await render(makeProps())
    expect(seen.splitArgs).toHaveLength(1)
    expect(seen.splitArgs[0]).toEqual([
      SPLIT_PRESETS.rWorkbench.key,
      SPLIT_PRESETS.rWorkbench.defaultRatio,
      SPLIT_PRESETS.rWorkbench.bounds,
    ])
  })
})
