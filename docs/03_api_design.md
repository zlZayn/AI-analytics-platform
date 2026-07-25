# API 设计

本文件保留入口名称，规范内容统一维护在 [api.md](api.md)，避免两套响应结构和查询边界发生漂移。

核心约束：

- 所有 Route Handler 返回统一 `ApiResponse<T>` 和 `requestId`。
- 查询只允许单条 `SELECT/WITH`，在 PostgreSQL 只读事务中执行。
- 默认最多返回 5,000 行；超时和取消会终止底层 PostgreSQL 查询。
- 表预览仅接收 schema/table 标识符并由服务端引用。
- AI 输出必须通过供应商 JSON Schema 和本地运行时合同。
