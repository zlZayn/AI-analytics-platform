# 发布与维护清单 — 每次改动的勾选项

- 定位：本文件只放「必须勾」的清单，说明与命令细节在 [verification.md](verification.md)。
- 改动完成后逐条勾选；能落脚本的已落脚本（见 [scripts/README.md](../scripts/README.md)）。

## A. 开发轮次（每次改代码）

- [ ] 改模块必跑对应测试与全套命令：见 [verification.md](verification.md)「本地验证」
- [ ] 改 API 路由 → 同步 `scripts/offline_workspace_e2e.py` 的 `page.route`（少一个 mock 就 500）
- [ ] 新编辑器接入 → 先 `await configureMonaco()` 再渲染（`src/lib/monaco-setup.ts`，勿顶层 import）
- [ ] 图表/UI 颜色 → 只用 `src/app/globals.css` 语义 token（组件不建第二套常量）
- [ ] 改 AI 契约（ai-contract）→ 提示词、解析、AiVisibilityHint 文案、测试同步
- [ ] 改 `.cmd` → 字节级编辑（GBK+CRLF+无 BOM），见 [决策记录](../.agents/notes/2026-09-03-windows-script-encoding-rules.md)
- [ ] 文档同步（改了什么 → 对应文档节）：根 [AGENTS.md](../AGENTS.md)（验证快照/待办/活跃坑 + 英文 README 同步）· [PLAN.md](PLAN.md)（待办勾掉/新计划）· 对应子 README · 新设计决策 → [.agents/notes/](../.agents/notes/)；职责边界见 [ARCHITECTURE.md](ARCHITECTURE.md) 文档网节
- [ ] 三连校验：`python scripts/check-links.py .` · `python <skill>/check-line-endings.py . --exclude .next --exclude node_modules --exclude .git` · `git diff --check`
- [ ] 测试数字漂移 → 如实更新根 [AGENTS.md](../AGENTS.md) 验证快照（增删用例 → 改数字并说明）

## B. 版本与发布（每次改动 bump，发版时重建验收）

改动性质决定档位，bump 与改动同一次提交：

| 档位 | 何时用 | 示例 |
| :--- | :--- | :--- |
| patch | 修复、文档、测试 | 连接编辑回填修复 |
| minor | 功能或行为变化 | 结果区数据表归属调整 |
| major | 破坏性契约变更 | API 响应结构变更 |

- [ ] **bump 版本**：`node scripts/bump-version.mjs {major|minor|patch}`（只改 package.json 的 version 一行、低位置零；sidebar 徽标与烟测断言自动跟随）
- [ ] **重建 + 重启**：版本号只在构建产物里生效——清 `.next` 后 `npm run build`（或 Start Dev.cmd 询问选"是"）
- [ ] 浏览器验收（Ctrl+Shift+R 硬刷新）：徽标显示新版本号 + 核心路径走查（探索页「在工作台执行」→ 自动执行等）
- [ ] 改 Prisma schema → **严禁 `npx prisma db push` / migrate**，手写 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`（见 [prisma/README.md](../prisma/README.md)）

## C. 启动与收尾（每次会话）

- [ ] 启动：`Start Dev.cmd` 自动做新鲜度检测（`node scripts/freshness.js`，OK/STALE/NOT_BUILT），STALE 时选"是"重建并重启旧实例
- [ ] 收尾提交：`git add -A` → 小提交（一个 commit 一件事）→ `git push` → `git status -sb` 确认本地=远程
- [ ] 会话结束：根 [AGENTS.md](../AGENTS.md) 就地更新（验证快照/待办/活跃坑），滞后即技术债

## 相关文档

- 测试与人工验收 [verification.md](verification.md) · 脚本用法 [scripts/README.md](../scripts/README.md) · 设计决策 [ARCHITECTURE.md](ARCHITECTURE.md) · 维护者索引 [AGENTS.md](../AGENTS.md)
