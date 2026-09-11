// 分割比例：纯逻辑（夹紧 + 本地持久化）
//
// 统一给工作台纵向（编辑器高度）、工作台横向（AI/结果宽度）、R 面板纵向（代码/输出）复用。
// 比例语义：**前一块占容器可用尺寸的比例**（0..1）；尺寸计算由调用方按自身方向取 width/height。

export type SplitAxis = "x" | "y"

/** 三处分割的预设（key 用于本地记忆，必须互不相同；比例语义见上） */
export const SPLIT_PRESETS = {
  /** 工作台纵向：SQL 编辑器占主区高度的比例（lg 及以上可拖拽） */
  workspaceEditor: { key: "workspace-editor", defaultRatio: 0.28, bounds: { min: 0.15, max: 0.6 } },
  /** 工作台横向：AI 助手占中段宽度的比例（lg 及以上可拖拽） */
  workspaceColumns: { key: "workspace-columns", defaultRatio: 0.4, bounds: { min: 0.25, max: 0.6 } },
  /** R 面板纵向：代码区占面板内容高度的比例 */
  rWorkbench: { key: "r-workbench", defaultRatio: 0.62, bounds: { min: 0.35, max: 0.8 } },
  /** R 面板宽度：占视口宽度的比例（调用方按像素边界换算，默认约 620px） */
  rWorkbenchWidth: { key: "r-workbench-width", defaultRatio: 0.43, bounds: { min: 0.25, max: 0.85 } },
} as const satisfies Record<string, { key: string; defaultRatio: number; bounds: SplitBounds }>

export interface SplitBounds {
  min: number
  max: number
}

export const SPLIT_STORAGE_PREFIX = "analytics-split:"

/** 非法值回退默认；越界夹紧（保证两侧都可见） */
export function clampRatio(value: number, fallback: number, bounds: SplitBounds): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(bounds.max, Math.max(bounds.min, value))
}

type RatioStorage = Pick<Storage, "getItem" | "setItem"> | null

function defaultStorage(): RatioStorage {
  return typeof window === "undefined" ? null : window.localStorage
}

export function readStoredRatio(
  key: string,
  fallback: number,
  bounds: SplitBounds,
  storage: RatioStorage = defaultStorage(),
): number {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(SPLIT_STORAGE_PREFIX + key)
    return raw === null ? fallback : clampRatio(Number(raw), fallback, bounds)
  } catch {
    return fallback
  }
}

export function writeStoredRatio(
  key: string,
  ratio: number,
  storage: RatioStorage = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(SPLIT_STORAGE_PREFIX + key, String(ratio))
  } catch {
    // 存储不可用（隐私模式）：本次拖拽仍生效，仅不记忆
  }
}

export function splitStorageKey(key: string, storage: RatioStorage = defaultStorage()): string | null {
  return storage ? SPLIT_STORAGE_PREFIX + key : null
}
