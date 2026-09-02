# scripts/ — 运维脚本手册

- 职责：模拟数据生成 + 浏览器验收脚本（守护 [docs/manual-acceptance.md](../docs/manual-acceptance.md) 的人工流程）
- `seed.py`：生成模拟业务数据；只读 `SEED_DATABASE_URL`，不回退 `DATABASE_URL`
- `final_ui_smoke.py`：360/768/1280/1440 四视口烟测，截图输出到 `.artifacts/ui-smoke`
- `offline_workspace_e2e.py`：离线工作台 E2E（10 种图表视图选择）
- `check-links.py`：Markdown 文档链接校验，CI 与本地共用；用法 `python scripts/check-links.py <目录|md文件>`
- 运行方式：浏览器脚本用 `BASE_URL` 覆盖地址，默认 `http://localhost:4321`（Next.js 16 拒绝跨来源 HMR）
- 变更影响路由：改脚本 → 同步根 [AGENTS.md](../AGENTS.md) 活跃坑（默认端口/输出目录）与 CI（.github/workflows/ci.yml）
- 工作约束与偏好 → [AGENTS.md](AGENTS.md)