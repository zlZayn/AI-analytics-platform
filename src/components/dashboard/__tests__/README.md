# __tests__/ — 结果面板测试

- 覆盖范围：受控/非受控 mapping 在重渲染后保持稳定（`embedded` 外框契约由上层结果容器承担）。
- 运行：`npx vitest run src/components/dashboard/__tests__`（全量 `npm test`，约定与 CI 见 [docs/testing.md](../../../../docs/testing.md)）
- 被测模块与改动路由 → [../README.md](../README.md)；工作约束 → [AGENTS.md](AGENTS.md)
