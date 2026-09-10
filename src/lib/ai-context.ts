// AI 上下文与可见范围声明（纯模块：客户端可安全导入，勿引入 prisma / schema-service）
//
// 单一来源：提示词注入什么、界面就声明什么；改注入 → 改这里 → 界面与文档同步。
// 定位与职责（只注入结构与轮廓、永不注入数据行、不做记忆与压缩）见
// [决策记录](../../.agents/notes/2026-09-11-ai-assistant-contract-and-context.md)。

export type ContextSourceName = "schema" | "dataProfile" | "chartContract" | "businessContext" | "history"

export interface ContextSource {
  name: ContextSourceName
  /** 一句话摘要（面板顶部提示用） */
  shortLabel: string
  /** 面向用户的「AI 能看见」描述 */
  label: string
  /** 采集失败或缺失时的行为（悬停可见，维护者据此判断降级影响） */
  fallback: string
}

export const CONTEXT_SOURCES: readonly ContextSource[] = [
  {
    name: "schema",
    shortLabel: "表结构",
    label: "当前连接的表结构（表名、字段名、数据库类型、注释）",
    fallback: "优先用 active 快照，缺失时现场扫描；扫描失败即请求失败",
  },
  {
    name: "dataProfile",
    shortLabel: "数据轮廓",
    label: "数据轮廓（每列唯一值数 / NULL 数 / 最小值 / 最大值 / 样本值；默认前 6 张表，@ 提及的表不受上限）",
    fallback: "采集失败静默跳过，不阻断分析",
  },
  {
    name: "chartContract",
    shortLabel: "图表契约",
    label: "图表契约（10 种图表类型及每种图表的必填/可选槽位与输出格式，AI 据此生成合适的图）",
    fallback: "始终注入，不随请求变化",
  },
  {
    name: "businessContext",
    shortLabel: "业务口径",
    label: "本次请求附带的业务口径（调用方传入的可信规则，AI 需遵守并回传引用了哪些规则）",
    fallback: "未传则不注入",
  },
  {
    name: "history",
    shortLabel: "会话历史",
    label: "本次会话的问答历史（前端传入，或按 conversationId 取最近 10 条）",
    fallback: "无历史即按单轮问答处理",
  },
]

/** AI 不可见边界：这些内容永远不会进入提示词 */
export const AI_NEVER_VISIBLE: readonly string[] = [
  "原始数据行（查询结果只在你看图表时才返回）",
  "连接密码、连接串、平台账号等敏感信息",
]

/** 执行边界说明 */
export const AI_EXECUTION_NOTE = "AI 直接生成结构化查询并自动执行；查询始终在只读事务内运行。"

export interface VisibilityDescription {
  summary: string
  visible: { label: string; fallback: string }[]
  hidden: string[]
  note: string
}

/** 界面从这里渲染可见范围，不再维护静态镜像 */
export function describeVisibility(): VisibilityDescription {
  return {
    summary: `AI 能看见：${CONTEXT_SOURCES.map((source) => source.shortLabel).join("、")}；看不见原始数据行`,
    visible: CONTEXT_SOURCES.map((source) => ({ label: source.label, fallback: source.fallback })),
    hidden: [...AI_NEVER_VISIBLE],
    note: AI_EXECUTION_NOTE,
  }
}

/** @ 提及表名规范化：去空、去重、保持顺序 */
export function normalizeReferencedTables(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const names: string[] = []
  for (const candidate of raw) {
    if (typeof candidate !== "string") continue
    const name = candidate.trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

export interface AIContextSummary {
  schemaBytes: number
  profileBytes: number
  businessBytes: number
  historyTurns: number
  referencedTables: string[]
}

/** 一条 trace：只有长度与条数，不含业务内容 */
export function describeContextTrace(summary: AIContextSummary): string {
  return [
    `schema=${summary.schemaBytes}`,
    `profile=${summary.profileBytes}`,
    `business=${summary.businessBytes}`,
    `history=${summary.historyTurns}`,
    `mentions=${summary.referencedTables.length || "auto"}`,
  ].join(" ")
}
