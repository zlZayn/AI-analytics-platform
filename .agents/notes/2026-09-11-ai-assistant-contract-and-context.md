# 决策：AI 助手契约与上下文分层（借鉴 Pi 的上下文工程）（2026-09-11）

已实施：P1（契约单一来源 + 修掉提示词与 schema 的矛盾）、P2（上下文分层 + 可见范围同源 + 请求 trace）、P3（编排收敛到 `useAiAssistant`，结果→action 单一映射）、P5（删除无调用方的 `/api/ai/insights`、`generateSQL` 别名与未使用的 `inferMapping`）

## 问题（审计证据）

- 同一份「洞察项契约」有四个表达：提示词散文（`ai-contract.ts` 输出契约段）、`AI_RESPONSE_JSON_SCHEMA`、`parseInsightItems`/`parseQuerySpec`/`parseMapping`、`validators.ts` 双模式校验。
- 三处已经互相打架：提示词要求「尽量同时输出 sql」，但优先变体（querySpec）的 schema 是 `additionalProperties: false` 且不含 `sql`——strict 模式下必然非法；模型是否照做取决于提供方是否真的执行 strict schema。
- 上下文注入是字符串拼接 `buildSystemPrompt(schemaContext, dataProfileText, businessContext)`：来源没有名字、优先级与预算，采集散在路由里（`/api/ai` 与 `/api/ai/insights` 各写一遍，后者无调用方）。
- 「AI 可见范围」是静态文案镜像（`ai-visibility-hint.tsx`），提示词一改即漂移（历史审计已记为已知问题）。
- 会话上下文全量拼接 `conversationHistory`：没有 token 预算、没有压缩；AI 编排散在 `session-workspace` 的 `sendAi`/`handleExecuteInsight`。
- 过渡期包袱：`/api/ai/insights`（无调用方）、`generateSQL` 别名、双变体回退的 `fallback` 标记。

## 借鉴 Pi（取其可用之处）

Pi（`@earendil-works/pi-coding-agent`）自称 minimal agent harness：核心最小化 + 扩展可编程化，把上下文工程做到系统提示之外。

| Pi 机制 | 本项目的取舍 |
| :--- | :--- |
| 极简核心 + 文件化指令（AGENTS.md / SYSTEM.md） | 契约声明留在代码里，提示词从同一份声明派生（P1） |
| 结构化上下文来源（`systemPromptOptions`：customPrompt/tools/contextFiles/skills…） | 引入 `ContextSection[]`（name/source/text/budget），渲染与可见范围共用一份来源（P2） |
| 压缩策略可插拔、按阈值触发（`contextTokens > contextWindow - reserveTokens`，默认 reserve 16384） | **不采纳**：本助手是单发分析建议，会话短、上下文有界（表结构 + 轮廓），压缩属长任务 agent 的问题 |
| 会话树 / 结构化重放 | **不采纳**：`AnalysisSession` 是唯一真相，单会话确定性管线 |
| 扩展 hooks / 工具循环 / 技能按需加载 | 不做 agent runtime：工具面固定为 querySpec + displayConfig + statTest |
| 可观测性（telemetry、进展文件） | 每次请求一条 trace 日志：模型、档位、各上下文段字符数、items 数、丢弃原因（P5） |

## 定位与职责边界（先定位置，再谈机制）

本助手的职责是「一次提问 → 1..6 条可执行建议（querySpec + displayConfig / 回退 SQL）→ 执行第一条」。据此明确不做：

- 不做 agent 运行时（工具循环、计划、自我修正轮次）
- 不做长期记忆与上下文压缩（会话短、上下文有界；压缩是长任务 agent 的问题）
- 不做会话树与分支重放（`AnalysisSession` 已是唯一真相）
- 不让 AI 直接接触数据行（只注入结构与轮廓，结果数据只回浏览器）

## 分阶段

- P1（本次）：`INSIGHT_FIELDS` 单一声明 → 提示词形状/字段说明、strict JSON Schema 变体、解析截断长度全部派生；删掉提示词与 schema 的 sql 矛盾。
- P2：`src/lib/ai/context.ts`：`buildContextSections()`（schema / 数据轮廓 / 业务口径 / @提及 / 历史）+ `renderContext()` + `describeVisibility()`；`/api/ai` 与 `AiVisibilityHint` 使用同一来源。
- P3：交互层收敛：`useAiAssistant`（idle/asking/error + 结果→会话 action 单一映射），`SessionWorkspace` 只负责挂载。
- P4：可观测性：每次请求一条 trace（模型、档位、各上下文段字符数、items 数、丢弃原因）。
- P5：清理：`/api/ai/insights` 与 `/api/ai` 共用采集与错误处理（前者当前无调用方，是否删除待维护者确认）；`generateSQL` 别名；文档对齐。

## 替代方案

- 照搬 Pi 的 agent 运行时（工具循环、会话树、扩展钩子）：本项目是单发确定性分析，不需要也不可控。
- 只写文档不动代码：契约漂移已被证实（sql 矛盾就是反例）。
- 一次性重写 `ai-contract.ts`：无法逐步验证，风险高于收益；改为按阶段落地，每阶段带测试。

## 影响

- 字段名、必填、截断长度改一处三面同步；模型看到的形状与实际校验一致。
- P2-P5 的落点与验收标准明确，可逐阶段提交。
