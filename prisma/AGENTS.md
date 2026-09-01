# prisma/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

prisma/ 特有约束：
- schema 变更必须生成迁移，用 `npx prisma migrate dev`，不手改 `../src/generated/prisma`
- 数据库名保持 `ai_analytics`（见 [决策记录](../.agents/notes/2026-09-01-keep-database-name-ai-analytics.md)）
- 不写"有什么文件/怎么改"，那是 [README.md](README.md) 的职责