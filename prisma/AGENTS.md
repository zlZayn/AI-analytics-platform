# prisma/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

prisma/ 特有约束：
- schema 演进手写 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`；**严禁 `prisma db push` / migrate**（会 DROP 业务表，见 [../AGENTS.md](../AGENTS.md) 活跃坑）；不手改 `../src/generated/prisma`
- 数据库名保持 `ai_analytics`（见 [决策记录](../.agents/notes/archived/2026-09-01-keep-database-name-ai-analytics.md)）
- 不写"有什么文件/怎么改"，那是 [README.md](README.md) 的职责
