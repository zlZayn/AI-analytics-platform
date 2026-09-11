# lib/ — 核心库与边界适配

- `workspace-navigation.ts`：跨页面工作台 URL、SQL 换行规范化、一次性 payload key；历史回放的 `buildHistoryWorkspaceUrl`（R 条目追加 `?r=<id>`）与 `parseRHistoryParam`。
- `split.ts`：分割比例纯逻辑（夹紧 + 本地持久化）与四处 `SPLIT_PRESETS`。
- `history-store.ts`：统一历史记录（AI 与会话 + R 执行，**连接级作用域**，单命名空间/版本/上限；与 workspace-store 的分工写在模块头）。
- `history-merge.ts`：后端 SQL 历史 + 前端 AI/R 历史的读取期合并（纯函数，时间线归一/排序/过滤/回放能力判定；不双写）。
- `workspace-store.ts`：工作台按连接的会话骨架 + 洞察流持久化（不存结果行；瞬态状态恢复为 ready）。
- `query-compiler.ts` / `sql-validator.ts`：QuerySpec 编译与只读 SQL 校验。
- `query-engine.ts` / `pool-registry.ts`：数据库查询执行与连接池生命周期。
- `render-binder.ts` / `validators.ts`：结果绑定和展示配置校验。
- `variable-types.ts`：图表类型清单（`CHART_TYPE_INFO` / `SELECTABLE_CHART_TYPES`）与映射槽位。
- `ai-contract.ts`：AI 输出契约单一来源（提示词 / JSON Schema / 解析来自同一份 `INSIGHT_FIELDS` 声明）。
- `ai-context.ts` / `ai-context-service.ts`：AI 上下文与可见范围声明（纯模块）+ 采集（服务端，AI 路由使用）。
- `ai-service.ts`：可注入的 `AICompletionProvider` 与 OpenAI 兼容生产 provider（请求头模板、`response_format` 降级、失败分类与用户可读提示）。
- `schema-service.ts`：当前连接的 Schema 上下文与数据轮廓（`scanDataProfile` / `buildDataProfileText`），AI 路由与可见性提示共用。
- `ai-session-mapping.ts`：AI 洞察项 → 会话 action 的单一映射（编译路径 / 回退 SQL）。
- `client-api.ts` / `api-response.ts`：客户端请求与服务端响应契约。
- `__tests__/`：核心库单元测试，详见 [__tests__/README.md](__tests__/README.md)。
- 规则 → [AGENTS.md](AGENTS.md)；设计 → [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)。
