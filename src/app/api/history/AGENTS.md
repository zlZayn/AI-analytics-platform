# history/ — 规则层

继承上级规则，见 [../AGENTS.md](../AGENTS.md)。

- 历史记录按 `connectionId` 限定，返回共享类型字段（`@/types/history`），响应统一走 `api-response` 助手。
- 写入只追加、不更新；每连接保留最新 `HISTORY_LIMIT` 条，不改 `query_history`（SQL 历史的权威源）。
