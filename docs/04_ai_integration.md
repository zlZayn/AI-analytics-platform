# AI 集成

## 边界

AI 根据当前连接扫描出的 Schema 建议 SQL 和图表映射，不直接访问数据库。提示词不包含行业模型、固定表名或业务样例。SQL/AI 负责聚合和数据整形；图表只执行固定展示算法。首次查询结果保持表格，AI 推荐只有在用户执行洞察后才应用。

## 模块

- `src/lib/ai-contract.ts`：图表合同、提示词构建、供应商 JSON Schema、SQL 和映射运行时校验。
- `src/lib/ai-service.ts`：可注入的 `AICompletionProvider` 和 OpenAI 兼容生产 provider。
- `src/lib/schema-service.ts`：生成当前连接 Schema 上下文。

`generateSQL(message, schemaContext, history, provider?)` 返回 `{ items }`。测试注入内存 provider，不需要 API Key，也不会调用真实模型。

## Structured Output

生产 provider 使用 `response_format.type = json_schema`、`strict = true`。根对象是 `{ items: [...] }`，每项包含 `title`、`insight`、单条 `SELECT/WITH` 和 `{ type, mapping }`。支持 table、line、bar、pie、scatter、boxplot、heatmap、correlation、kpi、histogram。

运行时仍执行第二道校验：

1. JSON 必须严格可解析，不提取代码围栏或自由文本。
2. SQL 通过与查询引擎一致的只读语法预检。
3. 图表类型、必填槽位和可选槽位必须匹配合同。
4. 映射列必须引用 SQL 中显式 `AS` 的输出别名。
5. 任一步失败即丢弃该项；不把不可信文本转成可执行 SQL。

## 配置

`AI_API_BASE`、`AI_API_KEY`、`AI_MODEL` 控制生产 provider。未配置 Key 时 API 返回稳定的未配置错误，应用构建和离线测试不受影响。模型温度为 0.2，以减少同一请求的结构漂移。

## 离线回归

`src/lib/__tests__/ai-contract.test.ts` 使用固定夹具覆盖提示词领域中立性、原生 Schema、未知图表、缺失映射、未知别名、非法 SQL、损坏 JSON 和 provider 注入。日常测试禁止使用真实 AI API。
