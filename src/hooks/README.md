# hooks/ — 会话与交互状态

- `useSession.ts`：编译、执行和重查副作用编排；编译按 `runId + querySpec` 去重，保证显式执行请求必定真的执行。
- `useAiAssistant.ts`：AI 助手编排（输入/请求/洞察流）；结果→会话 action 的映射用 [lib/ai-session-mapping.ts](../lib/ai-session-mapping.ts)。
- `sessionReducer.ts`：`AnalysisSession` 唯一状态转换入口。
- `useMentionInput.ts`：@ 提及输入状态机。面板开 = `hasMention && !dismissed && filtered.length > 0`；↑↓ 循环、Enter/Tab 选中、Escape 关闭不清输入、面板关时 Enter 提交；外部点击用 document `mousedown` 判定（blur 无法区分面板内外）。
- `lib/mention.ts`（纯函数搭档）：`extractPendingMention` 按空白分词并在 @ 前非标识符字符处触发（`对比@orders` 也弹面板，email 不误判）、`replaceMention` 替换为 `@name `（尾随空格关闭面板）、`extractMentions` 用合法标识符正则 + Set 去重。
- `useWebR.ts`：WebR 单例的 React 绑定。
- `useSplitRatio.ts`：可拖拽分割的比例状态（preview 拖拽中 / commit 写盘 / reset 复位），配合 `ui/split-handle`。
- `__tests__/`：会话 reducer、初始执行、AI 编排与 Hook 契约测试，覆盖范围见 [__tests__/README.md](__tests__/README.md)。
- 变更影响路由：会话状态改动 → `components/SessionView.tsx`、`components/workspace/` 与对应测试。
