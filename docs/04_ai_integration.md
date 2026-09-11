# AI 集成

## 边界

AI 根据当前连接扫描出的 Schema 与数据轮廓，建议结构化 QuerySpec + DisplayConfig，不直接访问数据库。提示词不包含行业模型、固定表名或业务样例。SQL/AI 负责聚合和数据整形；图表只执行固定展示算法。首次查询结果保持表格，AI 推荐只有在用户执行洞察后才应用。

## 定位与职责

助手是单发分析建议：一次提问 → 1..6 条建议（querySpec + displayConfig，或回退 sql + chart）→ 执行第一条。据此明确不做：

- 不做 agent 运行时（工具循环 / 计划 / 自我修正轮次）
- 不做长期记忆与上下文压缩（会话短、上下文有界；压缩属长任务 agent 的问题）
- 不做会话树与分支重放（`AnalysisSession` 是唯一真相）
- AI 不接触数据行：只注入结构与轮廓，结果数据只回浏览器

决策与被否决方案见 [.agents/notes/2026-09-11-ai-assistant-contract-and-context.md](../.agents/notes/2026-09-11-ai-assistant-contract-and-context.md)。

## 上下文分层

来源在 `src/lib/ai-context.ts` 的 `CONTEXT_SOURCES` 一处声明（纯模块，客户端可导入），采集在 `src/lib/ai-context-service.ts` 的 `collectAIContext` 一处实现，两个 AI 路由共用：

| 来源 | 采集与降级 |
| :--- | :--- |
| 表结构 | 优先 active 快照，缺失时现场扫描；扫描失败即请求失败 |
| 数据轮廓 | @ 提及的表逐个扫描（不受上限）；未提及自动前 6 表；失败静默跳过 |
| 图表契约 | 提示词常量，始终注入 |
| 业务口径 | 调用方传入才注入 |
| 会话历史 | 前端传入优先，否则按 conversationId 取最近 10 条 |

每次请求写一条 trace（`[ai] schema=… profile=… business=… history=… mentions=… items=…`），只含长度与条数，不含业务内容。

## 可见性边界（用户可见）

AI 提示词注入内容即 AI 可见范围；工作台 AI 助手面板顶部的「AI 可见范围」提示（`src/components/ai-visibility-hint.tsx`）由上述 `CONTEXT_SOURCES` 声明渲染，与注入同一来源，不再维护静态镜像文案。

- 可见：表名、字段名、数据库类型、数据轮廓（唯一值数 / NULL 数 / min/max / 样本值，最多 6 表）、图表契约（10 种类型 + 槽位规则 + 输出格式，`CHART_CONTRACTS`）、会话问答历史
- 不可见：查询结果数据行、连接密码、连接串、平台账号等敏感信息
- 注入实现：`buildSystemPrompt(schemaContext, dataProfileText)`（见 [ai-contract.ts](../src/lib/ai-contract.ts)）

## 显式表注入（@ 提及）

工作台 AI 输入支持 `@表名` 语法（`AiMentionInput`：输入 @ 弹表选择，键盘/鼠标选）。提交时 `referencedTables` 随请求体传给 `/api/ai`：

- 有 `referencedTables`：只扫描这些表的数据轮廓（数量不受自动上限约束），失败的表静默跳过
- 无 `referencedTables`：回退自动扫描前 6 表
- 图表类型与映射契约始终内置在系统提示词中，不随提及变化

## 输出契约（双变体）

AI 每项输出 `title`、`insight`、`querySpec` + `displayConfig`，或 `sql` + `chart`：

- `querySpec`：结构化查询（dimensions/measures/filters/having/sort/limit/joins），由 `query-compiler.ts` 编译为参数化 SQL（防注入，标识符分段引号）
- `displayConfig`：`{ chartType, mapping }`，由 `validators.ts` 双模式校验
- 回退规则：`querySpec` 存在时优先使用；缺失时回退 `sql` 直通，标记 `fallback=true`
- 单一来源：契约声明在 `src/lib/ai-contract.ts` 的 `INSIGHT_FIELDS`，提示词形状/字段说明、strict JSON Schema 变体、解析截断长度都由它派生；三面一致性由 AI 契约测试守卫（含「提示词必须含 json 字样」这条网关前置条件），测试分类见 [src/lib/__tests__/README.md](../src/lib/__tests__/README.md)

## 模块

- `src/lib/ai-contract.ts`：契约单一来源 `INSIGHT_FIELDS`（提示词形状/字段说明、strict JSON Schema 变体、解析截断长度全部派生；一致性测试见 [src/lib/__tests__/README.md](../src/lib/__tests__/README.md)）
- `src/lib/ai-context.ts`：上下文来源与可见范围声明（纯模块）、@ 提及规范化、trace 摘要
- `src/lib/ai-context-service.ts`：`collectAIContext`（表结构 → 轮廓 → 历史 → 业务口径；服务端）
- `src/lib/ai-service.ts`：可注入的 `AICompletionProvider` 和 OpenAI 兼容生产 provider（`generateAnalysis`：请求头模板、response_format 降级、错误描述）
- `src/hooks/useAiAssistant.ts`：AI 编排（输入/请求/洞察流），视图只负责挂载
- `src/lib/ai-session-mapping.ts`：洞察项 → 会话 action 的单一映射（querySpec 编译路径 / 回退 SQL 路径）
- `src/lib/schema-service.ts`：生成当前连接 Schema 上下文与数据轮廓（scanDataProfile / buildDataProfileText）
- `src/lib/query-compiler.ts`：QuerySpec → 参数化 SQL
- `src/lib/validators.ts`：schema-based / data-based 双模式校验

`generateAnalysis(message, schemaContext, conversationHistory, provider?, dataProfileText?, businessContext?, sessionId?)` 返回 `{ items }`。测试注入内存 provider，不需要 API Key，也不会调用真实模型。

## Structured Output

生产 provider 优先使用 `response_format.type = json_schema`、`strict = true`。提供方拒绝该类型时逐级降级：`json_object` → 不带 `response_format`（进程内记住可用档位并打日志，`AI_RESPONSE_FORMAT` 可显式指定起点）。根对象是 `{ items: [...] }`，每项为双变体 anyOf。支持 table、line、bar、pie、scatter、boxplot、heatmap、correlation、kpi、histogram。

降级为纯提示词约束时，字段名（title/insight/querySpec/displayConfig/sql/chart/context/statTest）与根对象形状必须写在提示词里——否则模型会自造字段名（如 description），解析后 items 为空。降级到 `json_object` 还要求提示词含 "json" 字样（提供方硬性要求），故契约段始终保留「只返回符合 JSON Schema 的对象」一句。

运行时仍执行第二道校验：

1. JSON 必须严格可解析，不提取代码围栏或自由文本。
2. 新变体：querySpec 经编译器编译验证；displayConfig 字段存在 + 槽位类型匹配（schema-based 模式）。
3. 旧变体：SQL 通过与查询引擎一致的只读语法预检；映射列必须引用 SQL 中显式 `AS` 的输出别名。
4. 新变体编译失败时回退旧变体 sql；两者皆失败即丢弃该项。
5. 任一步失败即丢弃该项；不把不可信文本转成可执行 SQL。

## 配置

`AI_API_BASE`、`AI_API_KEY`、`AI_MODEL` 控制真实 provider，三项均须显式配置，代码不再回退到任何私有端点或模型。任一项缺失时 API 在创建 SDK 和发起网络请求前返回稳定的未配置错误；应用构建、提示词合同测试和 fake provider 离线回归不受影响。模型温度为 0.2，以减少同一请求的结构漂移。

`AI_MODEL` 必须使用提供方文档中的模型 ID：多数网关用带版本号的 ID（如 `deepseek-v4-flash`），简写别名可能返回空内容而只表现为「未生成有效结果」。

`AI_API_HEADERS`（可选，JSON 对象）声明附加请求头，代码本身不内置任何网关专属头名：

- 值支持占位符 `{sessionId}`（本次会话，前端传 `session.id`，缺失时回退 connectionId）与 `{version}`（应用版本）
- 占位符无法解析时整条头丢弃，不发送空值
- 未声明 `User-Agent` 时补 `ai-analytics-platform/<version>`（部分网关拒绝通用 SDK 标识）
- 网关要求稳定会话头时写法示例：`AI_API_HEADERS={"x-opencode-session":"{sessionId}"}`

## JSON Output 纪律（对齐提供方文档）

1. `response_format` 按能力降级：`json_schema` → `json_object` → 无（当前网关只到 `json_object`）
2. 提示词必须含 "json" 字样并给出目标 JSON 样例：样例由 `INSIGHT_FIELDS` 生成，不手写
3. 合理设置输出预算 `AI_MAX_TOKENS`（默认 8000，夹在 1000..32000）：**推理模型的 reasoning token 也算在预算里**，预算过小会把 JSON 砍在半句
4. 提供方有概率返回空 content：首次解析失败时追加一条纠正指令，做**一次**有界修复（不是 agent loop，不引入工具与多轮规划）
5. 提示词按「宁可少而完整」约束：一次最多 3 条、每条 insight ≤ 200 字，避免为凑数量写长结论导致截断

## 失败分类与诊断

解析失败时接口回传 `diagnostics: { reason, message, attempts }`：`message` 是给用户的一句话，前端直接显示不做判断；原始响应片段只进服务端日志。日志一行给出 `items/reason/attempts/finish/tokens(reasoning)`。

| reason | 何时 | 用户可见提示 |
| :--- | :--- | :--- |
| `ok` | 有可用条目 | 无 |
| `empty` | 内容为空（提供方偶发） | AI 未返回内容，请再试一次 |
| `truncated` | `finish_reason=length` | 输出被截断，把问题拆小一点再问一次 |
| `invalid_json` | 不是合法 JSON | 返回的不是合法 JSON，换个更具体的问法再试 |
| `no_valid_item` | JSON 合法但无条目通过契约 | 返回不符合输出契约，换个更具体的问法再试 |

## 错误呈现

上游调用失败时接口返回具体原因，而不是「稍后重试」：`message` 形如 `AI 分析失败：HTTP 400 MissingSessionID：<提供方原文>`，保留状态码与错误类型、抹掉密钥片段、截断 300 字，工作台显示在 AI 气泡里。

- 未配置或缺凭据 → `AI_NOT_CONFIGURED`（503），前端另显示 .env 指引横幅
- 其他上游失败 → `AI_FAILED`（500，retryable），服务端仍打印完整错误便于排查

## 离线回归

AI 契约测试（分类见 [src/lib/__tests__/README.md](../src/lib/__tests__/README.md)）使用固定夹具覆盖提示词领域中立性、原生 Schema、双变体解析、sql 回退、未知图表、缺失映射、未知别名、非法 SQL、损坏 JSON 和数据轮廓注入。日常测试禁止使用真实 AI API。

## 文档导航

- 设计决策 [ARCHITECTURE.md](ARCHITECTURE.md) · 使用入口 [README.md](../README.md)
