"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { WebRClient, type ROutputItem } from "@/lib/webr-client"
import type { SemanticDataset } from "@/types/session"

export interface UseWebRReturn {
  status: "idle" | "loading" | "ready" | "error"
  error?: string
  packages: string[]
  busy: boolean
  output: ROutputItem[]
  images: ImageBitmap[]
  lastExecMs: number | null

  init: () => Promise<void>
  ensurePackages: (pkgs: string[]) => Promise<void>
  execute: (code: string) => Promise<void>
  injectData: (ds: SemanticDataset) => Promise<void>
  interrupt: () => Promise<void>
  clearOutput: () => void
  destroy: () => void
}

// 模块级单例：页面生命周期内一个 WebRClient 实例
// （WebR 目标是单实例；模块级持有避免渲染期 ref 初始化被 lint 规则禁止）
const clientSingleton = new WebRClient()

/**
 * useWebR：WebRClient 的 React 绑定。
 * 单例经 useSyncExternalStore 订阅；执行/注入/清理不进入 sessionReducer。
 */
export function useWebR(): UseWebRReturn {
  const client = clientSingleton

  const state = useSyncExternalStore(
    useCallback((cb: () => void) => client.subscribe(cb), [client]),
    () => client.getState()
  )

  const actions = useMemo(
    () => ({
      init: () => client.init(),
      ensurePackages: (pkgs: string[]) => client.ensurePackages(pkgs),
      execute: (code: string) => client.execute(code),
      injectData: (ds: SemanticDataset) => client.injectData(ds),
      interrupt: () => client.interrupt(),
      clearOutput: () => client.clearOutput(),
      destroy: () => client.destroy(),
    }),
    [client]
  )

  return {
    status: state.status,
    error: state.error,
    packages: state.packages,
    busy: state.busy,
    output: state.output,
    images: state.images,
    lastExecMs: state.lastExecMs,
    ...actions,
  }
}