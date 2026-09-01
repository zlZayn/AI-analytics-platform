# src/ — 源码手册

- 职责：Next.js 16 App Router 应用源码（页面、API Route Handlers、组件、核心库）
- 测试全部内嵌在 `src/**/__tests__/`，无独立 tests/ 目录；`vitest.config.ts` include 为 `src/**/*.test.ts(x)`

## 目录职责

- `app/`：路由页面（layout/page/workspace/explorer/queries）+ `api/` Route Handlers
- `components/`：`layout/` 布局与连接上下文；`charts/` 图表系统（views/ 视图、algorithms/transform/pipeline 管线）；`dashboard/` 结果面板；`ui/` 基础组件
- `lib/`：核心库（AI 服务、查询引擎、SQL 校验、Schema 扫描、加密、池管理）
- `types/`：共享类型
- `generated/prisma/`：Prisma 生成客户端，可再生，不手改

## 关键导出与改动路由

- `lib/query-engine.ts`：SQL 执行 + 连接池，被 `app/api/query/*` 与 ai-service 依赖；改后跑 `lib/__tests__/` 全部
- `lib/sql-validator.ts`：SQL 白名单校验，被 query-engine 依赖；改后跑 `sql-validator.test.ts`、`sql-identifiers.test.ts`
- `lib/ai-contract.ts`：提示词与 JSON Schema，被 ai-service 依赖；改后跑 `ai-contract.test.ts`、`api-route-contract.test.ts`
- `lib/encryption.ts`：连接密码加密；改后跑 `encryption.test.ts`
- `components/charts/algorithms.ts`：统计算法（Type 7 箱线、分箱、相关系数）；改后跑 `charts/__tests__/algorithms.test.ts`
- `components/charts/transform.ts`、`pipeline.ts`：展示变换与管线；改后跑 `transform.test.ts`、`pipeline.test.ts`
- 任何模块改动 → 跑 `npm test`，数字更新到根 [AGENTS.md](../AGENTS.md) 验证快照

## 引用

- 工作约束与偏好 → [AGENTS.md](AGENTS.md)
- 设计决策与防错清单 → [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)