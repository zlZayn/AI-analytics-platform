# API 约定 — 对外 HTTP 契约

## 路由总表

| 方法 | 路由 | 功能 |
| :--- | :--- | :--- |
| GET/POST | `/api/connections` | 连接列表/创建 |
| GET/PUT/DELETE | `/api/connections/[id]` | 连接详情/更新/删除 |
| GET | `/api/schema/[connectionId]` | Schema 扫描/缓存 |
| POST | `/api/query` | 执行 SQL |
| POST | `/api/query/preview` | 安全表预览（schema/table 标识符） |
| GET | `/api/query/history` | 查询历史（SQL 执行） |
| GET/POST | `/api/history` | 统一历史（AI 提问 + R 执行）读写 |
| GET/POST | `/api/query/saved` | 保存的查询 |
| POST | `/api/ai` | AI 分析 (结构化 JSON 输出) |

## 统一响应

成功：`{ success: true, data, meta?, requestId }`。

失败：`{ success: false, error: { code, message, retryable }, requestId }`。服务端日志使用 `requestId` 关联完整异常；响应不得包含密码、连接串或数据库堆栈。客户端统一经 `fetchApi` 处理 HTTP 状态、非 JSON 响应、超时和取消。

## 查询

`POST /api/query` 接收 `{ connectionId, sql, timeout? }`。只允许单条 `SELECT`/`WITH`，数据库侧使用只读事务和有界 `statement_timeout`。请求取消或断开时调用 `pg_cancel_backend`，等待原查询结束后才释放连接。

结果包含 `columns`、`rows`、`rowCount`、`returnedRowCount`、`truncated`、`rowLimit` 和 `executionTimeMs`。`rowCount` 与 `returnedRowCount` 均表示实际返回行数；`rowLimit` 默认值与截断判定见 [operations.md](operations.md)。

`POST /api/query/preview` 接收 `{ connectionId, schema, table }`。标识符仅在服务端引用，预览固定最多 100 行并复用同一查询引擎；客户端不得拼接预览 SQL。

常用错误码：`INVALID_REQUEST`、`INVALID_QUERY`、`INVALID_IDENTIFIER`、`QUERY_CANCELLED`、`QUERY_TIMEOUT`、`QUERY_FAILED`、`CONNECTION_NOT_FOUND`。

## 统一历史（AI + R）

`GET /api/history?connectionId=<id>&kind=ai|r` 返回该连接最近 50 条（新的在前，`kind` 缺省不过滤）；`POST /api/history` 追加一条，请求体为 `{ connectionId, sessionId, kind, ok, ... }`——AI 记录带 `question/summary/items`，R 记录带 `code/sourceSql/output/imageCount`，`createdAt` 缺省用服务端时间（仅导入旧浏览器记录时透传）。权威源是元库 `analysis_history` 表；SQL 执行历史在 `query_history`，两者读取期由 `lib/history-merge.ts` 合并成时间线，不双写。写入只追加，超出 50 条的旧记录按连接清理。

常用错误码：`INVALID_REQUEST`、`HISTORY_FETCH_FAILED`、`HISTORY_CREATE_FAILED`。

## 连接与 Schema

连接更新、删除和不可恢复认证错误会失效对应连接池（池参数见 [operations.md](operations.md)）。`PUT /api/connections/[id]` 只更新请求体中出现的字段：编辑时不提交 `password` 即保留原密文，`username`/`ssl` 由客户端先取详情回填后再提交。Schema 刷新在单个事务中停用旧快照并创建新快照，数据库部分唯一索引保证每个连接最多一个 active 快照。

## AI

`POST /api/ai` 返回 `{ items: InsightItem[] }`，请求体可选 `referencedTables: string[]`（@ 提及的表）：有则只扫描这些表的数据轮廓（不受 6 表上限约束），无则自动扫描前 6 表。响应经供应商原生 JSON Schema structured output 与本地运行时校验双重把关，不合规项**降级保留**（图表回退表格、SQL 标记为仅供复制），不再整项丢弃；语义见 [ai-integration.md](ai-integration.md)。

输出双变体、提示词边界与 AI 可见范围见 [ai-integration.md](ai-integration.md)。

## 文档导航

- 定位：对外 HTTP 契约（路由、请求响应、错误码）；运行参数与限额见 [operations.md](operations.md)。
- 相关文档：设计决策 [ARCHITECTURE.md](ARCHITECTURE.md) · AI 合同 [ai-integration.md](ai-integration.md) · 使用入口 [README.md](../README.md)
