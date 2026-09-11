# queries/ — 查询管理页面

- `page.tsx`：收藏/历史 Tabs、搜索、复制、删除与工作台执行入口。
- 历史标签 = 统一时间线：后端 SQL 历史 + 前端 AI/R 历史（`lib/history-merge.ts` 合并，`components/history-timeline.tsx` 渲染），徽标区分来源，动作按回放能力降级（详见 [决策记录](../../../.agents/notes/2026-09-11-unified-history-timeline.md)）。
- 历史和收藏的 SQL 传递共用工作台导航契约，并通过完整文档导航进入工作台。
- 改入口后跑 `scripts/offline_workspace_e2e.py`。
