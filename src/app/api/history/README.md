# history/ — 统一历史接口（AI + R）

- `route.ts`：`GET ?connectionId=&kind=ai|r` 返回最近 `HISTORY_LIMIT` 条（新的在前）；`POST` 追加一条 AI 提问或 R 执行记录并清理超限旧记录。
- 权威源：元库 `analysis_history` 表（Prisma 模型 `AnalysisHistory`）；SQL 执行历史在 `query_history`，两者读取期由 `lib/history-merge.ts` 合并。
- 消费方：R 工作台（回放取代码）、查询管理页「历史」时间线、AI 助手（落库写在 `hooks/useAiAssistant.ts`）。
