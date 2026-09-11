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
- 版本号：每次改动按语义 bump `package.json` 的 version——修复/文档 = patch、功能或行为变化 = minor、破坏性契约变更 = major；命令 `node scripts/bump-version.mjs {major|minor|patch|X.Y.Z}`（只改一行，低位置零）；徽标在侧栏底部（`src/components/layout/sidebar.tsx` 读 `NEXT_PUBLIC_APP_VERSION`），**bump 后必须重建才生效**；脚本见 [scripts/README.md](scripts/README.md)，清单见 [docs/maintenance-checklist.md](docs/maintenance-checklist.md)

## 常用命令
- `npm test` · `npm run typecheck` · `npm run lint` · `npm run dev`

## 验证快照（2026-09-11，main 分支）
- vitest: 47 files / 250 passed / 0 failed
- typecheck / lint: 0 errors
- 生产 build: passed（清 `.next` 后）；生产端口离线 E2E（侧栏/探索/历史入口 SQL 填充、请求体、Monaco、结果区、明细原始行、连接编辑回填、AI 编排、洞察执行落地、切页恢复、R 面板停靠与关闭、移动端）: passed
- 真实 AI 调用（opencode zen go / `deepseek-flash`）: passed（网关拒绝 `json_schema` 时按 `json_object` → 无 `response_format` 降级；多图表复合提问 3 条、reason=ok、**输出预算需覆盖推理 token**——实测一次 3694 token 里 3133 是 reasoning）

## 待办
- [ ] 真实只读账号人工验收：[docs/manual-acceptance.md](docs/manual-acceptance.md)（含 R 工作台，见第 5 节）
- [ ] 联网实测 statTest 黑盒统计成功路径（离线 E2E 只覆盖错误路径），见 [docs/PLAN.md](docs/PLAN.md)
- [ ] 可选：R.wasm 预加载优化，见 [docs/PLAN.md](docs/PLAN.md)
- [ ] 可选：统一图表高度契约（探索图表填满剩余高度，图表视图当前固定 320px），见 [决策记录](.agents/notes/2026-09-11-detail-table-single-owner.md)

蓝图阶段 1-4 已完成（结果区三层 Tabs / 多洞察+业务上下文 / WebR 黑盒统计 / 体验打磨），决策见 [.agents/notes/](.agents/notes/)

## 活跃坑
- 烟测/开发服务器用 `http://localhost:4321`；行尾统一 LF（maintenance-flow 的 check-line-endings.py 检测）；**例外：根目录 `*.cmd` 必须 CRLF + GBK(ANSI) 编码、无 BOM、不用 chcp**（cmd 解析 LF 多行块报 "do was unexpected"；UTF-8 编码在记事本/控制台显示乱码；编辑铁律见 [决策记录](.agents/notes/2026-09-03-windows-script-encoding-rules.md)）
- typecheck 报 PrismaClient 缺模型属性（schemaSnapshot/connection）→ `node_modules/@prisma/client` 损坏，重装后必须 `npx prisma generate`
- `.next` 缓存 dev/prod 混用会致 build 失败（清 `.next` 再 build）；**增删 app 路由后 typecheck 可能被 `.next/types/validator.ts` 的旧生成类型绊住**（报「找不到已删除的 route.js」）→ 清 `.next` 再验；**Geist 字体已自托管（`src/app/fonts/`），构建/开发不联网**
- 浏览器烟测/E2E 需本地 chromium（Playwright），CI 不跑浏览器脚本
- 入口脚本 `Start Dev.cmd`/`Build.cmd` 有构建新鲜度检查（对比 `src`/`prisma` 排除 `generated` 与 `.next\BUILD_ID`），见 [README.md](README.md)
- **`next start`（Start Dev 生产模式）跑旧构建产物**：git pull 新代码后必须重建（Start Dev 询问时选"是"/F）；构建后脚本会结束旧 PID 再启动新实例，排查"改了什么没变化"先验 `.next` 是否含新内容
- `Start Dev.cmd` 的 `if (...)` 代码块内日志文本不得使用未转义圆括号，避免 CMD 报 `was unexpected at this time` 并闪退
- sidebar 版本徽标读 `NEXT_PUBLIC_APP_VERSION`（next.config.ts 从 package.json 注入）；**bump 后必须重建才生效**，否则页面仍是旧号码；烟测脚本按 package.json 版本断言它（bump 规则见「全局规则」）
- Monaco 已本地托管（`src/lib/monaco-setup.ts` 的惰性 `configureMonaco`：SSR 安全，配置完成前渲染占位避免 loader.init 回退 CDN）；`@monaco-editor/react` 默认从 CDN 拉引擎，新编辑器接入点必须「先 `await configureMonaco()` 再渲染编辑器」，顶层 `import "@/lib/monaco-setup"` 会在 SSR 评估 monaco-editor 而 window 崩（曾致 workspace 整页不可交互）
- R 分析工作台（WebR 0.6）：COI 头已配置（COOP/COEP）；R.wasm（12.3MB）与 R 包从 `webr.r-wasm.org` CDN 按需加载，离线不可用；包下载后会话内缓存（模块级单例），刷新页面需重下
- AI 调用失败先看 AI 气泡里的具体原因（含 HTTP 状态与提供方原文，不再只有「稍后重试」）；网关要求的自定义头用 `AI_API_HEADERS`（`{sessionId}`/`{version}` 占位符），`AI_MODEL` 必须用提供方文档的版本化 ID；改提示词必须保留「只返回符合 JSON Schema 的对象」一句（网关 `json_object` 模式硬性要求提示词含 "json" 字样，丢了会整体退化）；**推理模型的 reasoning token 计入 `AI_MAX_TOKENS`**，预算过小会把 JSON 砍在半句导致整轮作废（失败会分类并给一句可执行提示，见 [docs/04_ai_integration.md](docs/04_ai_integration.md) 失败分类表）
- E2E 脚本 mock 路由必须与 API 路由同步：新增/修改 app 路由时同步更新 `scripts/offline_workspace_e2e.py` 的 `page.route`
- 跨页工作台入口的 SQL 需经过 `workspace-navigation.ts` 规范化；工作台按 `connection + SQL` key 一次性应用，入口回归由离线 E2E 同时覆盖探索页与历史页
- **平台 DATABASE_URL 元库与业务数据同库**：`npx prisma db push` 会 DROP schema 未定义的表（fact_*/dim_* 业务表，曾有 25285 行险遭删除）——schema 演进必须手写 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`（对照 information_schema 定向补列，如 2026-09-04 为 query_history 补 error_code），严禁 db push / --accept-data-loss / migrate

## 文档地图
- 用途与用法：[README.md](README.md)
- 进行中计划与已知问题：[docs/PLAN.md](docs/PLAN.md)
- 发布与维护清单（每次改动/发版必维护项）：[docs/maintenance-checklist.md](docs/maintenance-checklist.md)
- 人工验收：[docs/manual-acceptance.md](docs/manual-acceptance.md)
- 测试说明：[docs/testing.md](docs/testing.md)
- 历史过程产物（已完成的维护设计与计划）：[docs/archive/](docs/archive/README.md)
