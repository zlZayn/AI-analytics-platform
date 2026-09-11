# scripts/ — 运维脚本手册

- 职责：模拟数据生成 + 浏览器验收脚本（守护 [docs/verification.md](../docs/verification.md) 的人工流程）
- `seed.py`：生成模拟业务数据；只读 `SEED_DATABASE_URL`，不回退 `DATABASE_URL`
- `final_ui_smoke.py`：360/768/1280/1440 四视口烟测，截图输出到 `.artifacts/ui-smoke`
- `offline_workspace_e2e.py`：离线工作台 E2E（10 种图表视图选择）
- `check-links.py`：Markdown 文档链接校验，CI 与本地共用；用法 `python scripts/check-links.py <目录|md文件>`
- `bump-version.mjs`：按语义 bump `package.json` 的 version（`major|minor|patch|X.Y.Z`，低位置零，只改一行）；档位规则见根 [AGENTS.md](../AGENTS.md) 全局规则，改后必须重建
- 运行方式：浏览器脚本用 `BASE_URL` 覆盖地址，默认 `http://localhost:4321`（Next.js 16 拒绝跨来源 HMR）
- 坑位：浏览器脚本需本地 chromium 且 CI 不跑；改 app 路由必须同步 `page.route` mock，否则 500
- 坑位：`.next` dev/prod 混用会致 build 失败，增删 app 路由后 typecheck 会被旧生成类型绊住 → 清 `.next` 再验
- 坑位：`next start` 跑旧构建产物（用 `freshness.js` 判定 OK/STALE/NOT_BUILT）；`Start Dev.cmd` 构建后会结束占用端口的旧 PID 再启动
- 坑位：`Start Dev.cmd` 的 `if (...)` 块内日志不得用未转义圆括号（CMD 报 `was unexpected at this time` 并闪退），改完用 `cmd.exe /d /c` 验证
- 变更影响路由：改脚本 → 同步根 [AGENTS.md](../AGENTS.md) 活跃坑（默认端口/输出目录）与 CI（.github/workflows/ci.yml）
- 工作约束与偏好 → [AGENTS.md](AGENTS.md)