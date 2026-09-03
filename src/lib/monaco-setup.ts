import { loader } from "@monaco-editor/react"

let configured: Promise<void> | null = null

/**
 * 本地托管 monaco：不从 CDN 拉取引擎（离线/内网可用）。
 * 惰性 + 浏览器守卫：模块顶层静态加载会在 SSR（node）评估 monaco-editor 而访问 window 报错；
 * 首次由编辑器组件调用，配置完成前组件渲染占位（避免 loader.init 在配置前执行回退 CDN）。
 */
export function configureMonaco(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!configured) {
    configured = Promise.all([
      import("monaco-editor"),
      import("monaco-editor/esm/vs/basic-languages/r/r.contribution.js"),
    ]).then(([monaco]) => {
      loader.config({ monaco })
    })
  }
  return configured
}