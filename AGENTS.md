<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Analytics Platform — 维护索引

## 全局规则
- Next.js 16 有破坏性变更：写代码前先读 `node_modules/next/dist/docs/` 对应指南
- 文档职责与引用契约见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)；决策记录 [.agents/notes/](.agents/notes/)
- 文档同步后跑 `python scripts/check-links.py . --fragments --refs`（锚点/引用未成链为警告级）；行尾与编码规则见 [决策记录](.agents/notes/2026-09-03-windows-script-encoding-rules.md)
- 版本号按语义 bump（修复/文档=patch、功能/行为=minor、破坏性=major）：`node scripts/bump-version.mjs {major|minor|patch|X.Y.Z}`，**bump 后必须重建**才在侧栏徽标生效
- 改根 [README.md](README.md) 必须同改 [README_en.md](README_en.md)（冲突时以中文为准）

## 常用命令
- `npm run verify`（typecheck + lint + test，与 CI 同口径）· `npm run dev`（端口 3000；浏览器脚本默认 4321）
- `npm run db:init`（幂等初始化/补齐元库）· `npm run db:check`（只读漂移检查）· Node 基线 22（`.node-version`）

## 验证快照（2026-09-11，main）
- 本地门禁 `npm run verify`：vitest 50 files / 289 passed / 0 failed；typecheck / lint: 0 errors、0 warnings
- 生产 build: passed（清 `.next` 后）；离线 E2E passed 且已进 CI（`e2e` job：入口 SQL 填充、请求体、Monaco、结果区、明细原始行、连接编辑回填、AI 编排、洞察执行、切页恢复、统一历史时间线合并、分割句柄含 R 面板宽度、R 面板停靠/关闭、移动端）
- 依赖与元库：`npm ci --ignore-scripts` 从锁文件全量重装 **879 包**通过（next 16.3.4 / react 19.2.8 / vitest 4.1.11 / jsdom 30 / openai 6.49）；空库 `npm run db:init` 建出 12 表 + 35 索引、`npm run db:check` 无漂移；现有库两次 `db:init` 幂等且行数不变；本地离线 E2E 在该依赖集上通过
- 真实 AI 调用（opencode zen go / `deepseek-flash`）: passed（`json_schema` → `json_object` → 无 `response_format` 降级；3 条洞察、reason=ok；输出预算须覆盖 reasoning token）
- R 图像输出（浏览器 + 联网，webr 0.6）: passed（ggplot 真实渲染；R 代码不得自行开/关图形设备，见 [决策记录](.agents/notes/2026-09-11-unified-history-store-and-r-canvas-ownership.md)）
- R 历史回放 + 服务端历史（浏览器 + 联网，真实连接 `dim_date`）: passed（历史页 R 条目「含图 1 张」→ 点「执行」自动开面板、未点运行即重跑出图；条目在元库 `analysis_history`，刷新/换浏览器仍在，见 [决策记录](.agents/notes/2026-09-11-history-persistence-and-r-replay-rerun.md)）

## 待办
- [ ] 联网人工验收 R 面板内恢复（重开面板恢复上次代码与文本输出）、`injecting` 提示与旧浏览器历史导入（图像输出、历史页 `?r=` 回放=重新执行出图、服务端历史跨浏览器可见已于 2026-09-11 浏览器确认）：[docs/verification.md](docs/verification.md)
- [ ] 真实只读账号人工验收：[docs/verification.md](docs/verification.md)
- [ ] 联网实测 statTest 黑盒统计成功路径（离线只覆盖错误路径）：[docs/PLAN.md](docs/PLAN.md)
- [ ] 可选：R.wasm 预加载、统一图表高度契约：[docs/PLAN.md](docs/PLAN.md)
- [ ] 确认生产部署形态（进程管理 / 反向代理保留 COOP+COEP / 服务器 Node 版本 / 元库备份）并补写 [docs/operations.md](docs/operations.md)「部署（待确认）」：[docs/operations.md](docs/operations.md)

## 活跃坑（只留判定，细节在各自 home）
- **元库与业务表同库**：严禁 `prisma db push` / migrate（会 DROP `fact_*`/`dim_*`），schema 演进手写 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`（见 [prisma/README.md](prisma/README.md)）
- `.next` 缓存 dev/prod 混用会致 build 失败；增删 app 路由后 typecheck 可能被旧生成类型绊住 → 清 `.next` 再验（见 [scripts/README.md](scripts/README.md)）
- 残留的 `next start` 子进程会锁住 `node_modules/@next/swc*.node`：`npm ci` 报 EPERM、新实例报 EADDRINUSE → 先按端口找占用 PID 杀掉再装/起（见 [scripts/README.md](scripts/README.md)）
- 安装脚本策略：CI 用 `npm ci --ignore-scripts`，本地 npm 12 也默认拦截依赖 pre/postinstall；两边都已验证可构建可运行，新增依赖若真需要 postinstall 要先验证（见 [docs/operations.md](docs/operations.md)）
- `next start` 跑旧构建：改了没变化先确认 `.next` 是否为最新（新鲜度检测见 [scripts/README.md](scripts/README.md)）
- 浏览器脚本依赖 `scripts/requirements.txt`（playwright，已锁版本）；离线 E2E 已在 CI 的 `e2e` job 跑，改 app 路由仍必须同步脚本的 `page.route` mock（见 [scripts/README.md](scripts/README.md)）
- `.cmd` 必须 CRLF + GBK + 无 BOM；`if (...)` 块内日志不得用未转义圆括号（见 [决策记录](.agents/notes/2026-09-03-windows-script-encoding-rules.md)）
- `node_modules/@prisma/client` 损坏时 typecheck 报缺模型属性 → 重装后 `npx prisma generate`（见 [prisma/README.md](prisma/README.md)）
- Monaco 已本地托管：新编辑器接入先 `await configureMonaco()` 再渲染，勿顶层 import（见 [src/AGENTS.md](src/AGENTS.md)）
- AI 失败先看气泡里的具体原因（HTTP 状态 + 提供方原文）；自定义头用 `AI_API_HEADERS` 占位符；提示词必须保留「只返回符合 JSON Schema 的对象」；reasoning token 计入 `AI_MAX_TOKENS`（见 [docs/ai-integration.md](docs/ai-integration.md)）
- R 工作台：R.wasm 与包从 CDN 按需下载，离线不可用；`ImageBitmap` 归 `WebRClient`（组件不得 `close()`）；**R 代码不得自己 `webr::canvas()` / `dev.off()`**（webR 靠执行前后画布缓存差集收图，自行关设备会让差集为空 → 没图）；顶层表达式由 `withAutoprint` 自动打印，ggplot 裸写即可；注入未完成时执行会等待；**图片不持久化，历史回放 = 清空后重新执行**（见 [r-workbench/README.md](src/components/r-workbench/README.md)）
- 跨页入口 SQL 经 `workspace-navigation.ts` 规范化，工作台按 `connection + SQL` 一次性应用（见 [src/lib/README.md](src/lib/README.md)）
- 统一历史两类权威源都在元库（SQL=`query_history`、AI/R=`analysis_history`），客户端 `lib/history-client.ts` 不落副本；R 历史回放 = 清空后重新执行（图片不持久化、只记 `imageCount`），`?r=` 取不到时面板提示「未找到」而非换一条（见 [决策记录](.agents/notes/2026-09-11-history-persistence-and-r-replay-rerun.md)）
- 文档校验脚本以 skill 版（maintenance-flow）为源头，只改项目 `scripts/` 副本会在下次同步被覆盖（见 [决策记录](.agents/notes/2026-09-11-doc-reference-link-convention.md)）
- **主分支受保护 + 阶段治理不开长命分支**：main 有 ruleset（必须走 PR；必需检查 `Lint · Typecheck · Test · Build · Docs` 与 `Offline E2E (browser)`；禁删禁强推）；改动在短命 PR 分支上小步提交、squash 合并后删分支。经 API 合并改动 `.github/workflows/` 的 PR 需要 `gh` 的 `workflow` scope（见 [决策记录](.agents/notes/2026-09-11-branch-hygiene.md)）

## 文档地图
- 用途与用法：[README.md](README.md) · [README_en.md](README_en.md)
- 设计决策与文档网：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 开发者手册（目录职责/页面路由/改动路由）：[src/README.md](src/README.md) · 图表算法 [src/components/charts/README.md](src/components/charts/README.md) · 数据层 [prisma/README.md](prisma/README.md)
- 接口 / AI 合同 / 运行参数：[docs/api.md](docs/api.md) · [docs/ai-integration.md](docs/ai-integration.md) · [docs/operations.md](docs/operations.md)
- 验证与维护：[docs/verification.md](docs/verification.md) · [docs/maintenance-checklist.md](docs/maintenance-checklist.md) · 进行中计划 [docs/PLAN.md](docs/PLAN.md)
- 历史留档：[docs/archive/](docs/archive/README.md) · [.agents/notes/archived/](.agents/notes/archived/)
