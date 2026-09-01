# 决策：数据库名保持 ai_analytics（2026-09-01）

已实施：保持

## 问题

项目目录与 npm 包名从 `ai-data-analytics` 重命名为 `AI-analytics-platform`，评估数据库名 `ai_analytics` 是否同步改名。

## 决策

数据库名保持 `ai_analytics`，不随项目名改名。
库名是部署数据：改名需要备份、迁移、停服与客户端切换，收益仅是命名一致。

## 替代方案（强制）

- 改名为 `ai_analytics_platform`：需要全量迁移与停机窗口，对功能无增益
- 改名并保留旧库一段时间：双库存活期引入双写与回滚风险

## 影响

- `.env.example` 的 DATABASE_URL 与文档中的库名引用保持不变
- 库名与 npm 包名解耦，包名可独立演进