# __tests__/ — 会话 Hook 测试

- 覆盖范围：`sessionReducer` 状态转换（含 RESET 与校验写入）、`useSession` 初始执行幂等、`useAiAssistant` 的提问/回退/未配置/卡片执行四条路径（mock 掉 client-api，不发真实请求）。
- 运行：`npx vitest run src/hooks/__tests__`（约定与 CI 见 [docs/verification.md](../../../docs/verification.md)）
- 被测 Hook 与改动路由 → [../README.md](../README.md)；工作约束 → [AGENTS.md](AGENTS.md)
