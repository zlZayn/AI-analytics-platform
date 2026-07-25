# API 约定

## 统一响应

成功：`{ success: true, data, meta?, requestId }`。

失败：`{ success: false, error: { code, message, retryable }, requestId }`。服务端日志使用 `requestId` 关联完整异常；响应不得包含密码、连接串或数据库堆栈。客户端统一经 `fetchApi` 处理 HTTP 状态、非 JSON 响应、超时和取消。

## 查询

`POST /api/query` 接收 `{ connectionId, sql, timeout? }`。只允许单条 `SELECT`/`WITH`，数据库侧使用只读事务和有界 `statement_timeout`。请求取消或断开时调用 `pg_cancel_backend`，等待原查询结束后才释放连接。

结果包含 `columns`、`rows`、`rowCount`、`returnedRowCount`、`truncated`、`rowLimit` 和 `executionTimeMs`。`rowCount` 与 `returnedRowCount` 均表示实际返回行数；默认 `rowLimit` 为 5,000，服务端额外读取一行判断 `truncated`。

`POST /api/query/preview` 接收 `{ connectionId, schema, table }`。标识符仅在服务端引用，预览固定最多 100 行并复用同一查询引擎；客户端不得拼接预览 SQL。

常用错误码：`INVALID_REQUEST`、`INVALID_QUERY`、`INVALID_IDENTIFIER`、`QUERY_CANCELLED`、`QUERY_TIMEOUT`、`QUERY_FAILED`、`CONNECTION_NOT_FOUND`。

## 连接与 Schema

连接更新、删除和不可恢复认证错误会失效对应连接池。Schema 刷新在单个事务中停用旧快照并创建新快照，数据库部分唯一索引保证每个连接最多一个 active 快照。

## AI

`POST /api/ai` 与 `POST /api/ai/insights` 返回 `{ items: InsightItem[] }`。模型响应必须通过原生 JSON Schema structured output 和本地运行时校验；非法 SQL、未知图表、非法槽位或引用未知 SQL 输出别名的映射会被丢弃，不存在文本 SQL 兜底。
