"use client"

import { WebR, ChannelType, type Shelter } from "webr"
import { buildDataFrameCode } from "@/lib/r-bridge"
import type { SemanticDataset } from "@/types/session"

export type ROutputItem = { type: string; data: string }

/** 注入规模阈值：超过则走 bind 预留路径（P1b 基准后按需实现） */
export const INJECT_CELL_THRESHOLD = 100_000
/** 执行默认超时（毫秒） */
export const DEFAULT_TIMEOUT_MS = 60_000

export interface WebRClientState {
  status: "idle" | "loading" | "ready" | "error"
  error?: string
  packages: string[]
  busy: boolean
  output: ROutputItem[]
  images: ImageBitmap[]
  lastExecMs: number | null
  listeners: Set<() => void>
}

export interface WebRClientOptions {
  /** 测试注入：替代真实 WebR 构造器 */
  WebRImpl?: typeof WebR
}

/**
 * WebR 客户端（非 React）：单例实例 + 状态机 + 执行/注入/清理。
 * useWebR hook 仅做 React 绑定；本类可独立单测。
 */
export class WebRClient {
  private state: WebRClientState = {
    status: "idle",
    packages: [],
    busy: false,
    output: [],
    images: [],
    lastExecMs: null,
    listeners: new Set(),
  }

  private instance: { webR: WebR; shelter: Shelter } | null = null
  private installed = new Set<string>()
  private WebRImpl: typeof WebR
  private initPromise: Promise<void> | null = null

  constructor(options: WebRClientOptions = {}) {
    this.WebRImpl = options.WebRImpl ?? WebR
  }

  getState(): WebRClientState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.state.listeners.add(listener)
    return () => this.state.listeners.delete(listener)
  }

  private notify() {
    this.state.listeners.forEach((l) => l())
  }

  private patch(partial: Partial<WebRClientState>) {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  async init(): Promise<void> {
    if (this.instance) return
    if (this.initPromise) return this.initPromise
    const promise = (async () => {
      this.patch({ status: "loading" })
      try {
        // 显式锁定 SharedArrayBuffer 通道（P1a 已实测 COI 生效；确定性优于自动选择，
        // 避免 CI/非标准浏览器静默回退 PostMessage 而失去 interrupt 能力）
        const webR = new this.WebRImpl({ channelType: ChannelType.SharedArrayBuffer })
        await webR.init()
        const shelter = await new webR.Shelter()
        this.instance = { webR, shelter }
        this.patch({ status: "ready" })
      } catch (e) {
        const msg = e instanceof Error ? e.message : "WebR 初始化失败"
        this.patch({ status: "error", error: msg })
        throw e
      } finally {
        this.initPromise = null
      }
    })()
    this.initPromise = promise
    return promise
  }

  async ensurePackages(pkgs: string[]): Promise<void> {
    if (!this.instance) throw new Error("WebR 未初始化")
    const missing = pkgs.filter((p) => !this.installed.has(p))
    if (missing.length === 0) return
    this.patch({ busy: true })
    try {
      await this.instance.webR.installPackages(missing)
      missing.forEach((p) => this.installed.add(p))
      this.patch({ packages: [...this.installed] })
    } finally {
      this.patch({ busy: false })
    }
  }

  async execute(code: string): Promise<void> {
    if (!this.instance) throw new Error("WebR 未初始化")
    this.patch({ busy: true })
    const start = performance.now()
    try {
      const capture = await this.instance.shelter.captureR(code, {
        withAutoprint: true,
        captureStreams: true,
        captureConditions: true,
      })
      this.patch({
        output: [
          ...this.state.output,
          ...capture.output.map((o) => ({
            type: String(o.type),
            data: typeof o.data === "string" ? o.data : String(o.data),
          })),
        ],
      })
      if (capture.images.length > 0) {
        this.patch({ images: [...this.state.images, ...capture.images] })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "R 代码执行失败"
      this.patch({ output: [...this.state.output, { type: "error", data: msg }] })
    } finally {
      this.patch({ busy: false, lastExecMs: Math.round(performance.now() - start) })
    }
  }

  async injectData(ds: SemanticDataset): Promise<void> {
    if (!this.instance) throw new Error("WebR 未初始化")
    const cellCount = ds.rows.length * ds.columns.length
    if (cellCount > INJECT_CELL_THRESHOLD) {
      // 预留：大数据量 bind 回退路径（P1b 基准后按需实现）
      this.patch({
        output: [
          ...this.state.output,
          { type: "warning", data: `数据集较大（${ds.rows.length} 行 × ${ds.columns.length} 列），注入可能较慢` },
        ],
      })
    }
    await this.instance.webR.evalR(buildDataFrameCode(ds))
  }

  async interrupt(): Promise<void> {
    await this.instance?.webR.interrupt()
  }

  clearOutput() {
    this.state.images.forEach((img) => img.close())
    this.patch({ output: [], images: [] })
  }

  destroy() {
    this.instance = null
    this.installed.clear()
    this.state.images.forEach((img) => img.close())
    this.patch({ status: "idle", packages: [], output: [], images: [], error: undefined, lastExecMs: null })
  }

  /** 数据集是否超过注入阈值（导出给工具/测试） */
  static isLargeDataset(ds: SemanticDataset): boolean {
    return ds.rows.length * ds.columns.length > INJECT_CELL_THRESHOLD
  }
}

/** 默认超时上限（导出供调用方使用；超时逻辑由调用方 Promise.race 实现） */
export function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`执行超时（>${timeoutMs / 1000}s）`)), timeoutMs)
    ),
  ])
}