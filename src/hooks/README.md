# hooks/ — 会话与交互状态

- `useSession.ts`：编译、执行和重查副作用编排。
- `sessionReducer.ts`：`AnalysisSession` 唯一状态转换入口。
- `useMentionInput.ts`：@ 提及输入状态机。
- `useWebR.ts`：WebR 单例的 React 绑定。
- `__tests__/`：会话 reducer、初始执行和 Hook 契约测试，详见 [__tests__/README.md](__tests__/README.md)。
- 变更影响路由：会话状态改动 → `components/SessionView.tsx`、`components/workspace/` 与对应测试。
