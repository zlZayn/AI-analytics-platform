# queries/ — 查询管理页面

- `page.tsx`：收藏/历史 Tabs、搜索、复制、删除与工作台执行入口。
- 历史和收藏的 SQL 传递共用工作台导航契约，并通过完整文档导航进入工作台。
- 改入口后跑 `scripts/offline_workspace_e2e.py`。
