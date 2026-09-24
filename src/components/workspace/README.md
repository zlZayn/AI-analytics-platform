# workspace/ — 会话工作台

- `session-workspace.tsx`：会话状态编排与布局（AI 助手、结果区、分割条；SQL 编辑器与保存查询各成文件）。AI 编排委托 [useAiAssistant](../../hooks/useAiAssistant.ts)，视图只负责挂载与布局。
- `sql-editor-panel.tsx`：SQL 编辑器单元——工具栏（保存查询 + 执行）与 Monaco 草稿区，本地 monaco 就绪状态归它；草稿 owner 仍在父组件（AI 助手会写）。
- `save-query-control.tsx`：「保存查询」单元——工具栏触发按钮 + 命名对话框 + `POST /api/query/saved`；输入只有 `connectionId` 与已编译 SQL，不读会话状态。
- 被 `/workspace` 路由依赖；初始 SQL 来自 `connection` 与 `sql` 查询参数。
- 执行入口：手动 SQL、探索页、查询管理页均调用统一 `buildWorkspaceUrl`；跨页 SQL 使用完整文档导航，到达后统一触发 `SET_COMPILED_SQL`。
- 布局可拖拽（仅 lg）：SQL 编辑器高度、AI 助手与结果区宽度，句柄与预设见 [lib/split.ts](../../lib/split.ts)；窄屏回到纵向滚动。
- 持久化：进入时按连接恢复会话骨架与洞察流（[lib/workspace-store.ts](../../lib/workspace-store.ts)），状态变化立即写回；结果行与执行物（compiledSql/querySpec）不恢复，避免进入即重跑，恢复后默认停在「洞察」Tab、点一次「执行」重看结果。
- 改动后必测：会话与导航测试（见 [../../hooks/__tests__/README.md](../../hooks/__tests__/README.md)、[../../lib/__tests__/README.md](../../lib/__tests__/README.md) 的会话与导航类）与浏览器验收脚本（见 [scripts/README.md](../../../scripts/README.md)）。
- 规则 → [AGENTS.md](AGENTS.md)；设计 → [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)。
