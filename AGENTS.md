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

## 验证快照（2026-09-01）
- vitest: 20 files / 59 passed / 0 failed

## 待办
- [ ] 真实只读账号人工验收：[docs/manual-acceptance.md](docs/manual-acceptance.md)

## 活跃坑
- 烟测/开发服务器用 `http://localhost:4321`；行尾统一 LF（maintenance-flow 的 check-line-endings.py 检测）

## 文档地图
- 用途与用法：[README.md](README.md)
- 实现状态：[docs/implementation-status.md](docs/implementation-status.md)
- 人工验收：[docs/manual-acceptance.md](docs/manual-acceptance.md)
- 测试说明：[docs/testing.md](docs/testing.md)