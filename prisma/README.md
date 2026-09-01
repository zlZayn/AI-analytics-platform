# prisma/ — 数据层手册

- 职责：平台元数据表（数据库连接、Schema 快照、查询历史、保存查询、用户、AI 会话）
- `schema.prisma`：唯一 schema 源；`generator client` 输出到 `../src/generated/prisma`
- `migrations/`：数据库迁移；schema 变更后跑 `npx prisma migrate dev`
- 数据库名 `ai_analytics` 保持不动（见 [决策记录](../.agents/notes/2026-09-01-keep-database-name-ai-analytics.md)）
- 变更影响路由：改 schema → 迁移 + 重新 generate → 同步根 [AGENTS.md](../AGENTS.md)
- 工作约束与偏好 → [AGENTS.md](AGENTS.md)