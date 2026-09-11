# types/ — 跨层类型契约

- `index.ts`：连接、Schema、查询结果和统一 API 响应类型。
- `session.ts`：`AnalysisSession`、`QuerySpec`、`CompiledSql`、`SemanticDataset`、`DisplayConfig`。
- `actions.ts`：会话 reducer Action 联合类型。
- `history.ts`：统一历史记录契约（AI 提问 / R 执行条目与追加入参，服务端 `analysis_history` 表的对端类型）。
- 类型契约改动后检查 `hooks/`、`components/`、`app/api/` 和完整测试。
