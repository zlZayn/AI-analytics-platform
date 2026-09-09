# workspace/ — 会话工作台

- `session-workspace.tsx`：SQL 编辑器、AI 助手、执行按钮、结果区和保存查询。
- 被 `/workspace` 路由依赖；初始 SQL 来自 `connection` 与 `sql` 查询参数。
- 执行入口：手动 SQL、探索页、查询管理页均调用统一 `buildWorkspaceUrl`；跨页 SQL 使用完整文档导航，到达后统一触发 `SET_COMPILED_SQL`。
- 改动后必测：`src/hooks/__tests__/`、`src/lib/__tests__/workspace-navigation.test.ts`、`scripts/offline_workspace_e2e.py`。
- 规则 → [AGENTS.md](AGENTS.md)；设计 → [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)。
