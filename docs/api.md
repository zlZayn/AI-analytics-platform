# API 约定

成功响应为 `{ success: true, data, meta?, requestId }`。失败响应保留兼容的 `error` 文本，同时提供 `{ code, message, retryable }` 的 `errorInfo` 和 `requestId`。

查询结果包含 `rowCount`、`returnedRowCount`、`truncated`、`rowLimit`、`columns`、`rows` 和 `executionTimeMs`。`rowCount` 表示实际返回行数；总行数不能在未执行完整查询时假定。

查询在数据库只读事务内执行，使用受控的 `statement_timeout`。客户端请求必须处理非 JSON 错误、HTTP 状态、取消和超时。
