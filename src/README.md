# src/ — 源码手册

- 职责：Next.js 16 App Router 应用源码（页面、API Route Handlers、组件、核心库）
- 测试全部内嵌在 `src/**/__tests__/`，无独立 tests/ 目录；`vitest.config.ts` include 为 `src/**/*.test.ts(x)`

## 目录职责

- `app/`：路由页面（layout/page/workspace/explorer/queries）+ `api/` Route Handlers（ai/、ai/insights、connections、query/、schema/）+ `fonts/` 自托管 Geist 字体（`next/font/local`，构建不联网）
- `components/`：`layout/` 布局与连接上下文；`charts/` 图表系统（views/ 视图、algorithms/transform 管线）；`dashboard/` 结果面板；`workspace/` 会话工作台；`SessionView.tsx` 会话渲染（loading/error/图表）；`AiVisibilityHint.tsx` AI 可见性提示（用户可见边界）；`AiMentionInput.tsx` + `AiMentionPanel.tsx` @ 提及选表（显式上下文注入）；`ui/` 基础组件
- `hooks/`：`useSession.ts`（会话状态 + 副作用）、`sessionReducer.ts`（19 种 Action 纯函数转换）、`useMentionInput.ts`（@ 提及状态机：面板开关/键盘导航/选中）
- `lib/`：核心库（AI 服务、查询编译器、校验器、渲染绑定、查询引擎、SQL 校验、Schema 扫描、数据轮廓、加密、池管理、`mention.ts` @ 提及纯逻辑、`monaco-setup.ts` 本地 monaco 配置）
- `types/`：共享类型 + 会话类型（`session.ts` 唯一真相源：AnalysisSession/QuerySpec/SemanticDataset/DisplayConfig）
- `generated/prisma/`：Prisma 生成客户端，可再生，不手改
- 编辑器：Monaco 从 npm 包本地加载（`monaco-setup.ts` 的 `loader.config`），不访问 CDN，离线可用

## 页面路由

| 路由 | 功能 |
| :--- | :--- |
| `/` | 连接选择与管理 (侧边栏下拉切换) |
| `/workspace?connection=xxx` | 数据工作台 (SQL 编辑 + AI 助手 + @ 选表) |
| `/explorer?connection=xxx` | 数据探索 (Schema 浏览) |
| `/queries?connection=xxx` | 查询管理 (收藏 + 历史) |

## 关键导出与改动路由

- `lib/query-engine.ts`：SQL 执行 + 连接池，返回 SemanticDataset；被 `app/api/query/*` 与 ai-service 依赖；改后跑 `lib/__tests__/` 全部
- `lib/query-compiler.ts`：QuerySpec → 参数化 SQL（防注入）；被 useSession 副作用依赖；改后跑 `query-compiler.test.ts`
- `lib/validators.ts`：双模式（schema-based/data-based）校验；被 sessionReducer 与 SessionView 依赖；改后跑 `validators.test.ts`
- `lib/render-binder.ts`：Dataset + DisplayConfig → 图表数据（坐标翻转/无效数值过滤）；改后跑 `render-binder.test.ts`
- `lib/ai-contract.ts`：提示词与 JSON Schema（双变体 anyOf）；被 ai-service 依赖；改后跑 `ai-contract.test.ts`、`api-route-contract.test.ts`
- `hooks/sessionReducer.ts`：会话状态转换；改后跑 `hooks/__tests__/sessionReducer.test.ts`
- `lib/sql-validator.ts`：SQL 白名单校验；改后跑 `sql-validator.test.ts`、`sql-identifiers.test.ts`
- `lib/encryption.ts`：连接密码加密；改后跑 `encryption.test.ts`
- `components/charts/algorithms.ts`：统计算法（Type 7 箱线、分箱、相关系数）；改后跑 `charts/__tests__/algorithms.test.ts`
- `components/charts/transform.ts`：展示变换；改后跑 `transform.test.ts`
- 任何模块改动 → 跑 `npm test`，数字更新到根 [AGENTS.md](../AGENTS.md) 验证快照

## 引用

- 工作约束与偏好 → [AGENTS.md](AGENTS.md)
- 设计决策与防错清单 → [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)