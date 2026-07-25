# 测试约定

纯算法、请求封装和组件合同使用 Vitest + jsdom；浏览器布局烟测使用项目内 Playwright 脚本。算法测试必须覆盖空值、非有限值、常量列、并列值、重复坐标、极端值和大数据边界。

关键回归场景包括查询超时、真实取消、5,000 行截断、连接池失效、Schema 唯一快照、非 JSON API 错误、请求竞态、图表算法、窗口化表格、AI structured output、亮色一致性和窄屏布局。`light-theme-contract.test.ts` 防止暗色分支回流；AI 测试必须注入 fake provider，禁止调用真实 API。

提交前运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run build` 和 `git diff --check`。真实 PostgreSQL 的权限、取消和认证失效仍按 `manual-acceptance.md` 人工复核。

浏览器验证：先在 4321 端口启动应用，然后运行 `python scripts/final_ui_smoke.py`（四视口布局/亮色/导航）和 `python scripts/offline_workspace_e2e.py`（API mock 下执行查询并切换全部 10 种视图）。开发服务器运行离线 E2E 时设置 `BASE_URL=http://localhost:4321`，生产服务器可使用默认 `127.0.0.1`。
