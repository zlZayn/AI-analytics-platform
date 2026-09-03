# AI 集成

## 边界

AI 根据当前连接扫描出的 Schema 与数据轮廓，建议结构化 QuerySpec + DisplayConfig，不直接访问数据库。提示词不包含行业模型、固定表名或业务样例。SQL/AI 负责聚合和数据整形；图表只执行固定展示算法。首次查询结果保持表格，AI 推荐只有在用户执行洞察后才应用。

## 可见性边界（用户可见）

AI 提示词注入内容即 AI 可见范围；工作台 AI 助手面板顶部有「AI 可见范围」提示（`src/components/ai-visibility-hint.tsx`），用户可展开查看。

- 可见：表名、字段名、数据库类型、数据轮廓（唯一值数 / NULL 数 / min/max / 样本值，最多 6 表）、会话问答历史
- 不可见：查询结果数据行、连接密码、连接串、平台账号等敏感信息
- 注入实现：`buildSystemPrompt(schemaContext, dataProfileText)`（见 [ai-contract.ts](../src/lib/ai-contract.ts)）

## 输出契约（双变体）

AI 每项输出 `title`、`insight`、`querySpec` + `displayConfig`，或 `sql` + `chart`：

- `querySpec`：结构化查询（dimensions/measures/filters/having/sort/limit/joins），由 `query-compiler.ts` 编译为参数化 SQL（防注入，标识符分段引号）
- `displayConfig`：`{ chartType, mapping }`，由 `validators.ts` 双模式校验
- 回退规则：`querySpec` 存在时优先使用；缺失时回退 `sql` 直通，标记 `fallback=true`

## 模块

- `src/lib/ai-contract.ts`：提示词构建、供应商 JSON Schema（双变体 anyOf）、运行时校验、数据轮廓注入
- `src/lib/ai-service.ts`：可注入的 `AICompletionProvider` 和 OpenAI 兼容生产 provider；`generateAnalysis`（`generateSQL` 为兼容别名）
- `src/lib/schema-service.ts`：生成当前连接 Schema 上下文与数据轮廓（scanDataProfile / buildDataProfileText）
- `src/lib/query-compiler.ts`：QuerySpec → 参数化 SQL
- `src/lib/validators.ts`：schema-based / data-based 双模式校验

`generateAnalysis(message, schemaContext, dataProfileText, history, provider?)` 返回 `{ items }`。测试注入内存 provider，不需要 API Key，也不会调用真实模型。

## Structured Output

生产 provider 使用 `response_format.type = json_schema`、`strict = true`。根对象是 `{ items: [...] }`，每项为双变体 anyOf。支持 table、line、bar、pie、scatter、boxplot、heatmap、correlation、kpi、histogram。

运行时仍执行第二道校验：

1. JSON 必须严格可解析，不提取代码围栏或自由文本。
2. 新变体：querySpec 经编译器编译验证；displayConfig 字段存在 + 槽位类型匹配（schema-based 模式）。
3. 旧变体：SQL 通过与查询引擎一致的只读语法预检；映射列必须引用 SQL 中显式 `AS` 的输出别名。
4. 新变体编译失败时回退旧变体 sql；两者皆失败即丢弃该项。
5. 任一步失败即丢弃该项；不把不可信文本转成可执行 SQL。

## 配置

`AI_API_BASE`、`AI_API_KEY`、`AI_MODEL` 控制真实 provider，三项均须显式配置，代码不再回退到任何私有端点或模型。任一项缺失时 API 在创建 SDK 和发起网络请求前返回稳定的未配置错误；应用构建、提示词合同测试和 fake provider 离线回归不受影响。模型温度为 0.2，以减少同一请求的结构漂移。

## 离线回归

`src/lib/__tests__/ai-contract.test.ts` 使用固定夹具覆盖提示词领域中立性、原生 Schema、双变体解析、sql 回退、未知图表、缺失映射、未知别名、非法 SQL、损坏 JSON 和数据轮廓注入。日常测试禁止使用真实 AI API。
## 文档导航
- 设计决策 [ARCHITECTURE.md](ARCHITECTURE.md) · 使用入口 [README.md](../README.md)
