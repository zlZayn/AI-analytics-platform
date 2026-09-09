# api/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- Route Handler 统一返回 `ApiResponse<T>`，错误必须带 code、message、retryable。
- 数据库写操作遵守元库与业务表隔离规则，禁止 db push/migrate。
