"use client"

// AI 助手面板：标题栏（含「重置」）+ 可见范围提示 + 对话流 + @ 提及输入与发送。
// 编排全在 useAiAssistant（本组件只收句柄）；会话侧的 RESET dispatch 留在父组件。
import { Button } from "@/components/ui/button"
import { AiVisibilityHint } from "@/components/ai-visibility-hint"
import { AiMentionInput } from "@/components/ai-mention-input"
import type { AiAssistant } from "@/hooks/useAiAssistant"
import type { SchemaData } from "@/types"
import type { ConversationMessage } from "@/types/session"
import { Loader2, Send } from "lucide-react"

interface AiAssistantPanelProps {
  assistant: AiAssistant
  conversationHistory: ConversationMessage[]
  schema: SchemaData | null
  /** 会话在编译/执行中：与 asking 一起决定「重置」是否可点 */
  busy: boolean
  /** 「重置」：清洞察流与会话状态（会话侧动作由父组件 dispatch，本组件不碰 session） */
  onReset: () => void
}

export function AiAssistantPanel({ assistant, conversationHistory, schema, busy, onReset }: AiAssistantPanelProps) {
  return (
    <div className="flex min-h-[260px] min-w-0 flex-1 flex-col rounded-lg border lg:min-h-0 lg:[flex-basis:0] lg:[flex-grow:var(--ai-grow)]">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">AI 助手</span>
          <span className="hidden truncate text-[10px] text-[var(--muted-foreground)] sm:inline">
            提问 → 给出可执行洞察 → 点卡片「执行」看结果
          </span>
        </span>
        {conversationHistory.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px]"
            onClick={onReset}
            disabled={busy || assistant.asking}
          >
            重置
          </Button>
        )}
      </div>
      <AiVisibilityHint />
      <div className="flex-1 overflow-auto p-3 space-y-2 min-h-0">
        {assistant.unavailable && (
          <div className="p-2 rounded bg-[var(--muted)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] leading-relaxed">
            AI 服务未配置。请在 <code className="font-mono bg-[var(--border)] px-1 rounded">.env</code> 中设置
            {' '}<code className="font-mono bg-[var(--border)] px-1 rounded">AI_API_KEY</code>。
          </div>
        )}
        {conversationHistory.length === 0 && !assistant.unavailable && (
          <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-xs">
            用自然语言描述你想分析的内容
          </div>
        )}
        {conversationHistory.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs bg-[var(--primary)] text-[var(--primary-foreground)]">
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs bg-[var(--muted)] text-[var(--foreground)] whitespace-pre-wrap">
                {msg.content}
              </div>
            </div>
          ),
        )}
        {assistant.asking && (
          <div className="flex justify-start">
            <div className="bg-[var(--muted)] rounded-lg px-2.5 py-1.5 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
              <Loader2 className="w-3 h-3 animate-spin" /> 思考中...
            </div>
          </div>
        )}
      </div>
      <div className="p-2 border-t flex gap-1.5">
        <AiMentionInput
          value={assistant.input}
          onChange={assistant.setInput}
          onSend={assistant.ask}
          disabled={assistant.asking}
          placeholder="输入 @ 选表，如：对比 @orders 与 @customers 的销售趋势"
          schema={schema}
        />
        <Button size="sm" onClick={assistant.ask} disabled={assistant.asking || !assistant.input.trim()} className="h-7 w-7 p-0">
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
