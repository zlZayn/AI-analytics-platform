"use client"

import { useState } from "react"
import { Eye } from "lucide-react"

/**
 * AI 可见性提示：告诉用户 AI 在当前会话中能看见什么（对齐 buildSystemPrompt 实际注入）。
 * 展示在 AI 助手面板顶部；一行小结 + 点击展开详情。
 */
export function AiVisibilityHint() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[var(--accent)] transition-colors cursor-pointer"
        title="点击查看 AI 能看见什么"
      >
        <Eye className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
        <span className="text-[10px] text-[var(--muted-foreground)]">
          {expanded ? "AI 可见范围（点击收起）" : "AI 能看见：表结构、数据轮廓、图表契约与业务口径；看不见原始数据行"}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          <div className="rounded bg-[var(--muted)] border border-[var(--border)] p-2 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
            <div className="font-medium text-[var(--foreground)]">AI 能看见</div>
            <div>· 当前连接的表名、字段名、数据库类型（Schema）</div>
            <div>· 数据轮廓：每列唯一值数、NULL 数、最小值/最大值、样本值（最多 6 张表）</div>
            <div>· 图表契约：10 种图表类型 + 每种图表的必填/可选槽位规则与输出格式（AI 据此生成合适的图）</div>
            <div>· 本次会话的问答历史</div>
            <div>· 企业业务口径定义（若已配置，AI 生成 SQL 时遵守，并在结果中回传引用了哪些规则）</div>
            <div className="font-medium text-[var(--foreground)] mt-1">AI 看不见</div>
            <div>· 原始数据行（查询结果只在你看图表时才返回）</div>
            <div>· 连接密码、连接串、平台账号等敏感信息</div>
            <div className="mt-1 text-[var(--muted-foreground)]/80">AI 直接生成结构化查询并自动执行；查询始终在只读事务内运行。</div>
          </div>
        </div>
      )}
    </div>
  )
}