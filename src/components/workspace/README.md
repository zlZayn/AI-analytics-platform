# workspace/ — 会话工作台

- `session-workspace.tsx`：SQL 编辑器、AI 助手、执行按钮、结果区和保存查询。
- 被 `/workspace` 路由依赖；初始 SQL 来自 `connection` 与 `sql` 查询参数。
- 执行入口：手动 SQL、探索页、查询管理页均调用统一 `buildWorkspaceUrl`；跨页 SQL 使用完整文档导航，到达后统一触发 `SET_COMPILED_SQL`。
- 改动后必测：会话与导航测试（见 [../../hooks/__tests__/README.md](../../hooks/__tests__/README.md)、[../../lib/__tests__/README.md](../../lib/__tests__/README.md) 的会话与导航类）与浏览器验收脚本（见 [scripts/README.md](../../../scripts/README.md)）。
- 规则 → [AGENTS.md](AGENTS.md)；设计 → [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)。
