# explorer/ — 数据探索页面

- `page.tsx`：表列表、字段/关联/预览 Tabs，以及「在工作台执行」入口。
- 入口 SQL 由统一导航库编码，并通过完整文档导航传给工作台；工作台负责填充和执行。
- 改动后跑 `scripts/offline_workspace_e2e.py`。
