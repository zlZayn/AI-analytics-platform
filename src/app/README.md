# app/ — 页面与 Route Handler

- `page.tsx`：连接选择入口。
- `workspace/`：SQL 会话工作台，详见 [workspace/README.md](workspace/README.md)。
- `explorer/`：Schema 浏览与工作台入口，详见 [explorer/README.md](explorer/README.md)。
- `queries/`：收藏/历史查询与工作台入口，详见 [queries/README.md](queries/README.md)。
- `api/`：连接、Schema、查询和 AI Route Handler，详见 [api/README.md](api/README.md)。
- `fonts/`：自托管 Geist 字体资源。
- 改页面交互后必测：`scripts/offline_workspace_e2e.py`；改 API 后同步 mock 路由。
