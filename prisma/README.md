# prisma/ — 数据层手册

- 职责：平台元数据表（数据库连接、Schema 快照、查询历史、分析历史 AI/R、保存查询、用户、AI 会话）
- `schema.prisma`：唯一 schema 源；`generator client` 输出到 `../src/generated/prisma`
- `bootstrap.sql`：**全量基线**（12 张元数据表 + 索引 + 固定属主 `default-user`，全部 `IF NOT EXISTS`/`ON CONFLICT DO NOTHING`）；空库据此建到可用状态，现有库重复执行只补缺失对象、不动数据。入口 `npm run db:init`
- `migrations/`：增量补丁（数据修复、加列/加索引）；**元库与业务数据同库，schema 演进必须手写 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，禁止 db push / migrate**（见根 [AGENTS.md](../AGENTS.md) 活跃坑）
- 漂移检查：`npm run db:check` 只读比对 `schema.prisma` 与库里的表/列（含"每连接最多一个 active 快照"索引），漂移即退出码 1
- 新增模型时的固定动作：改 `schema.prisma` → 补 `bootstrap.sql` → 补 `migrations/` 增量 → `npm run db:init` → `npm run db:check` → `npx prisma generate`
- 数据库名 `ai_analytics` 保持不动（见 [决策记录](../.agents/notes/archived/2026-09-01-keep-database-name-ai-analytics.md)）
- 坑位：`node_modules/@prisma/client` 损坏时 typecheck 报缺模型属性（schemaSnapshot/connection）→ 重装依赖后必须 `npx prisma generate`
- 变更影响路由：改 schema → schema 演进（手写 ALTER）+ 重新 generate → 同步根 [AGENTS.md](../AGENTS.md)
- 工作约束与偏好 → [AGENTS.md](AGENTS.md)