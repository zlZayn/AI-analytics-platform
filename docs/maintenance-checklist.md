# 发布与维护清单

用途：每次改动/发布必须维护的事项（防止版本号忘 bump、验证数字漂移、旧构建、mock 不同步）。改动完成后逐条勾选；能落命令的已给命令，能落脚本的已落脚本。

## A. 开发轮次（每次改代码）

- [ ] 改模块必跑对应测试：`npm test`（测试与被测模块同目录 `__tests__/`，清单见 [src/README.md](../src/README.md)）
- [ ] `npm run typecheck` · `npm run lint`
- [ ] 改 API 路由 → 同步 `scripts/offline_workspace_e2e.py` 的 `page.route`（少一个 mock 就 500）
- [ ] 新编辑器接入 → 先 `await configureMonaco()` 再渲染（`src/lib/monaco-setup.ts`，勿顶层 import）
- [ ] 图表/UI 颜色 → 只用 `src/app/globals.css` 语义 token（组件不建第二套常量）
- [ ] 改 AI 契约（ai-contract）→ 提示词、解析、AiVisibilityHint 文案、测试同步
- [ ] 改 `.cmd` → 字节级编辑（GBK+CRLF+无 BOM），见 [决策记录](../.agents/notes/2026-09-03-windows-script-encoding-rules.md)
- [ ] 文档同步（改了什么 → 对应文档节）：[implementation-status.md](implementation-status.md)（状态/数字）· [PLAN.md](PLAN.md)（待办勾掉/新计划）· [uiux-handoff.md](uiux-handoff.md)（现状事实）· 新设计决策 → [.agents/notes/](../.agents/notes/)
- [ ] 三连校验：`python scripts/check-links.py .` · `python <skill>/check-line-endings.py . --exclude .next --exclude node_modules --exclude .git` · `git diff --check`
- [ ] 测试数字漂移 → 如实更新 [AGENTS.md](../AGENTS.md) 验证快照（增删用例 → 改数字并说明）

## B. 发布/版本（每次发版）

- [ ] **bump 版本**：`node scripts/bump-version.mjs X.Y.Z`（只改 package.json 的 version 一行；sidebar 徽标与烟测断言自动跟随）
- [ ] **重建 + 重启**：版本号只在构建产物里生效——清 `.next` 后 `npm run build`（或 Start Dev.cmd 询问选"是"），然后**杀掉旧 next start 实例再启动新实例**（多实例堆叠会造成旧 manifest 混合态，页面功能随机失效）
- [ ] 浏览器验收（Ctrl+Shift+R 硬刷新避免旧 chunk 缓存）：徽标显示新版本号 + 核心路径走查（探索页「在工作台执行」→ 自动执行等）
- [ ] 改 Prisma schema → **严禁 `npx prisma db push` / migrate**（DATABASE_URL 元库与业务表同库，会 DROP fact_*/dim_* 业务表）；对照 `information_schema.columns` 手写 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`（见 [AGENTS.md](../AGENTS.md) 活跃坑）

## C. 启动与收尾（每次会话）

- [ ] 启动：`Start Dev.cmd` 自动做新鲜度检测（`node scripts/freshness.js`，OK/STALE/NOT_BUILT），STALE 时选"是"重建；**端口被占时它只打开浏览器**——若怀疑旧实例，先手动确认页面徽标版本号
- [ ] 收尾提交：`git add -A` → 小提交（一个 commit 一件事）→ `git push` → `git status -sb` 确认本地=远程
- [ ] 会话结束：AGENTS.md 会话内就地更新（验证快照/待办/活跃坑），滞后即技术债

## 自动化脚本（scripts/）

| 脚本 | 做什么 | 何时用 |
| :--- | :--- | :--- |
| `bump-version.mjs` | 改 package.json version 一行（校验 X.Y.Z 格式） | 每次发版 |
| `freshness.js` | 源码 vs `.next\BUILD_ID` 时间对比 → OK/STALE/NOT_BUILT | Start Dev.cmd / Build.cmd 自动调用 |
| `check-links.py` | Markdown 相对链接校验 | 每次文档同步后 |
| `final_ui_smoke.py` / `offline_workspace_e2e.py` | 浏览器烟测 / 离线 E2E（localhost:4321） | 每次 UI 改动后（需本地 chromium，CI 不跑） |