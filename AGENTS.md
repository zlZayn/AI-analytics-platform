<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Analytics Platform — 维护索引

## 全局规则
- Next.js 16 有破坏性变更：写任何代码前先读 `node_modules/next/dist/docs/` 对应指南
- 文档分层与引用契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 决策记录：[.agents/notes/](.agents/notes/)
- 文档同步后跑链接校验（maintenance-flow skill 的 check-links.py，从 skill 目录执行）

## 常用命令
- `npm test` · `npm run typecheck` · `npm run lint` · `npm run dev`

## 验证快照（2026-09-02，refactor-plan 分支）
- vitest: 24 files / 106 passed / 0 failed
- typecheck / lint: 0 errors
- 生产 build: passed（清 `.next` 后）；浏览器烟测/离线 E2E 脚本: passed

## 待办
- [ ] 真实只读账号人工验收：[docs/manual-acceptance.md](docs/manual-acceptance.md)
- [ ] refactor-plan 合并回 main（重构 v4.5 已完成，见 [REFACTOR_STATUS.md](REFACTOR_STATUS.md)）

## 活跃坑
- 烟测/开发服务器用 `http://localhost:4321`；行尾统一 LF（maintenance-flow 的 check-line-endings.py 检测）；**例外：根目录 `*.cmd` 必须 CRLF + UTF-8 无 BOM**（cmd 解析 LF 多行块报 "do was unexpected"）
- typecheck 报 PrismaClient 缺模型属性（schemaSnapshot/connection）→ `node_modules/@prisma/client` 损坏，重装后必须 `npx prisma generate`
- `.next` 缓存 dev/prod 混用会致 build 失败（font module-not-found）；先删 `.next` 再 build
- 浏览器烟测/E2E 需本地 chromium（Playwright），CI 不跑浏览器脚本

## 文档地图
- 用途与用法：[README.md](README.md)
- 实现状态：[docs/implementation-status.md](docs/implementation-status.md)
- 人工验收：[docs/manual-acceptance.md](docs/manual-acceptance.md)
- 测试说明：[docs/testing.md](docs/testing.md)