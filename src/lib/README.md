# lib/ — 核心库与边界适配

- `workspace-navigation.ts`：跨页面工作台 URL、SQL 换行规范化、一次性 payload key。
- `query-compiler.ts` / `sql-validator.ts`：QuerySpec 编译与只读 SQL 校验。
- `query-engine.ts` / `pool-registry.ts`：数据库查询执行与连接池生命周期。
- `render-binder.ts` / `validators.ts`：结果绑定和展示配置校验。
- `client-api.ts` / `api-response.ts`：客户端请求与服务端响应契约。
- `__tests__/`：核心库单元测试，详见 [__tests__/README.md](__tests__/README.md)。
- 规则 → [AGENTS.md](AGENTS.md)；设计 → [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)。
