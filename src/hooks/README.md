# hooks/ — 会话与交互状态

- `useSession.ts`：编译、执行和重查副作用编排。
- `sessionReducer.ts`：`AnalysisSession` 唯一状态转换入口。
- `useMentionInput.ts`：@ 提及输入状态机。面板开 = `hasMention && !dismissed && filtered.length > 0`；↑↓ 循环、Enter/Tab 选中、Escape 关闭不清输入、面板关时 Enter 提交；外部点击用 document `mousedown` 判定（blur 无法区分面板内外）。
- `lib/mention.ts`（纯函数搭档）：`extractPendingMention` 按空白分词并在 @ 前非标识符字符处触发（`对比@orders` 也弹面板，email 不误判）、`replaceMention` 替换为 `@name `（尾随空格关闭面板）、`extractMentions` 用合法标识符正则 + Set 去重。
- `useWebR.ts`：WebR 单例的 React 绑定。
- `__tests__/`：会话 reducer、初始执行和 Hook 契约测试，详见 [__tests__/README.md](__tests__/README.md)。
- 变更影响路由：会话状态改动 → `components/SessionView.tsx`、`components/workspace/` 与对应测试。
