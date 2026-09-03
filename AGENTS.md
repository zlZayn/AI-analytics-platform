<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Analytics Platform — 维护索引

## 全局规则
- Next.js 16 有破坏性变更：写任何代码前先读 `node_modules/next/dist/docs/` 对应指南
- 文档分层与引用契约：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 决策记录：[.agents/notes/](.agents/notes/)
- 文档同步后跑链接校验（`python scripts/check-links.py <路径>`，CI 亦用）

## 常用命令
- `npm test` · `npm run typecheck` · `npm run lint` · `npm run dev`

## 验证快照（2026-09-03，main 分支）
- vitest: 28 files / 166 passed / 0 failed
- typecheck / lint: 0 errors
- 生产 build: passed（清 `.next` 后）；浏览器烟测/离线 E2E（含 R 工作台错误态断言）: passed

## 待办
- [ ] 真实只读账号人工验收：[docs/manual-acceptance.md](docs/manual-acceptance.md)（含 R 工作台，见第 5 节）
- [ ] UIUX 方案 A（结果区 Tabs：图表/数据表/R 分析）待拍板实施，见 [docs/PLAN.md](docs/PLAN.md)
- [ ] P2：AI 生成 R 代码（等待 P1 使用反馈，见 [docs/PLAN.md](docs/PLAN.md)）

## 活跃坑
- 烟测/开发服务器用 `http://localhost:4321`；行尾统一 LF（maintenance-flow 的 check-line-endings.py 检测）；**例外：根目录 `*.cmd` 必须 CRLF + GBK(ANSI) 编码、无 BOM、不用 chcp**（cmd 解析 LF 多行块报 "do was unexpected"；UTF-8 编码在记事本/控制台显示乱码；编辑铁律见 [决策记录](.agents/notes/2026-09-03-windows-script-encoding-rules.md)）
- typecheck 报 PrismaClient 缺模型属性（schemaSnapshot/connection）→ `node_modules/@prisma/client` 损坏，重装后必须 `npx prisma generate`
- `.next` 缓存 dev/prod 混用会致 build 失败（清 `.next` 再 build）；**Geist 字体已自托管（`src/app/fonts/`），构建/开发不联网**
- 浏览器烟测/E2E 需本地 chromium（Playwright），CI 不跑浏览器脚本
- 入口脚本 `Start Dev.cmd`/`Build.cmd` 有构建新鲜度检查（对比 `src`/`prisma` 排除 `generated` 与 `.next\BUILD_ID`），见 [README.md](README.md)
- **`next start`（Start Dev 生产模式）跑旧构建产物**：git pull 新代码后必须重建（Start Dev 询问时选"是"/F），否则改动不生效；排查"改了什么没变化"先验 `.next` 是否含新内容
- sidebar 版本徽标读 `NEXT_PUBLIC_APP_VERSION`（未配置时隐藏）；烟测脚本按 package.json 版本断言它
- Monaco 已本地托管（`src/lib/monaco-setup.ts` 的惰性 `configureMonaco`：SSR 安全，配置完成前渲染占位避免 loader.init 回退 CDN）；`@monaco-editor/react` 默认从 CDN 拉引擎，新编辑器接入点必须「先 `await configureMonaco()` 再渲染编辑器」，顶层 `import "@/lib/monaco-setup"` 会在 SSR 评估 monaco-editor 而 window 崩（曾致 workspace 整页不可交互）
- R 分析工作台（WebR 0.6）：COI 头已配置（COOP/COEP）；R.wasm（12.3MB）与 R 包从 `webr.r-wasm.org` CDN 按需加载，离线不可用；包下载后会话内缓存（模块级单例），刷新页面需重下
- E2E 脚本 mock 路由必须与 API 路由同步：新增/修改 app 路由时同步更新 `scripts/offline_workspace_e2e.py` 的 `page.route`

## 文档地图
- 用途与用法：[README.md](README.md)
- 实现状态：[docs/implementation-status.md](docs/implementation-status.md)
- 人工验收：[docs/manual-acceptance.md](docs/manual-acceptance.md)
- 测试说明：[docs/testing.md](docs/testing.md)