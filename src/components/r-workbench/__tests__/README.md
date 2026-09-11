# __tests__/ — R 工作台测试

- 覆盖范围：面板布局的纯逻辑（代码/输出分割比例的默认值与夹紧），真实 R 执行与渲染由离线 E2E 覆盖错误路径、人工验收覆盖成功路径。
- 运行：`npx vitest run src/components/r-workbench/__tests__`（全量 `npm test`，约定与 CI 见 [docs/testing.md](../../../../docs/testing.md)）
- 被测模块与改动路由 → [../README.md](../README.md)；工作约束 → [AGENTS.md](AGENTS.md)
