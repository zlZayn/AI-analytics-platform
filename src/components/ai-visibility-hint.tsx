"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
import { describeVisibility } from "@/lib/ai-context"

/**
 * AI 可见性提示：内容由 lib/ai-context 的上下文声明渲染（与提示词注入同一来源），
 * 不再维护静态镜像文案。展示在 AI 助手面板顶部：一行摘要 + 点击展开详情。
 */
export function AiVisibilityHint() {
  const [expanded, setExpanded] = useState(false)
  const { summary, visible, hidden, note } = describeVisibility()

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
          {expanded ? "AI 可见范围（点击收起）" : summary}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2">
          <div className="rounded bg-[var(--muted)] border border-[var(--border)] p-2 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
            <div className="font-medium text-[var(--foreground)]">AI 能看见</div>
            {visible.map((item) => (
              <div key={item.label} title={item.fallback}>· {item.label}</div>
            ))}
            <div className="font-medium text-[var(--foreground)] mt-1">AI 看不见</div>
            {hidden.map((item) => (
              <div key={item}>· {item}</div>
            ))}
            <div className="mt-1 text-[var(--muted-foreground)]/80">{note}</div>
          </div>
        </div>
      )}
    </div>
  )
}
