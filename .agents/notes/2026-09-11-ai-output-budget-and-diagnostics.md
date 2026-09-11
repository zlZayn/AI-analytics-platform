# 决策：AI 输出预算、失败分类与有界修复（2026-09-11）

已实施

## 问题（实测证据）

- 真实提问「@fact_orders @dim_member 做一下适合柱状图箱线图和折线图的数据，要足够有价值」返回 `items=0`。服务端日志显示响应只有 **654 字符**且停在 `"aggregatio`——**JSON 被截断**，`JSON.parse` 失败后整轮归零。
- 同网关探针实测该模型：`completion_tokens=2655`，其中 **`reasoning_tokens=1768`**。`max_tokens` 硬编码 4000，可见输出只剩约 900 token；要求多条目/长结论时必然砍在半句。
- 失败只有一句「未生成有效结果」：`finish_reason`/`usage`/丢弃原因都不出日志，界面也没有任何入口。

## 决策

- 一次补全返回 `AICompletion { content, finishReason, usage }`（含 reasoning token）；`generateAnalysis` 统一产出 `AIServiceResult { items, reason, message, attempts, finishReason, usage, rawPreview }`。
- 失败分类 `AIOutcomeReason`：`ok` / `empty` / `truncated` / `invalid_json` / `no_valid_item`；**用户可见提示由后端给出**（`diagnostics.message`），前端只显示。
- `AI_MAX_TOKENS` 可配（默认 8000，夹在 1000..32000），覆盖推理开销。
- **有界修复一次**：首次解析失败时追加一条纠正指令（只输出 1 条 items、insight ≤ 120 字）重问；不做第二次，不引入工具与多轮规划。
- 提示词加输出预算纪律：一次最多 3 条、每条 insight ≤ 200 字（宁可少而完整）。
- 日志一行到底：`items / reason / attempts / finish / tokens(reasoning)`；原始响应片段只进服务端日志。

## 借鉴 Pi（源码级结论，克制）

- Pi 的工具参数用 TypeBox 一份声明同时供三处：运行时校验、给模型的 JSON Schema、TS 静态类型（`packages/ai/src/types.ts`）。`INSIGHT_FIELDS` 是同一角色的实现（提示词形状 + JSON Schema + 解析截断），继续沿用。
- Pi 的工具执行管道是 Prepare（**JSON Schema 校验**）→ Execute → Finalize，**校验放在边界**；我们对应 `parseInsightItems`，有界修复是它最小的修复形式。
- Pi 没有 framework 级 `response_format: json_schema`；结构化终答靠一个 `terminate: true` 的 `structured_output` 工具（参考扩展 65 行）。
- **不采纳**：那个工具模式要求先有 agent 循环与工具注册表，而本助手是单发分析。
- **不采纳**：双层 agent loop、steering/followUp 队列、会话树 JSONL、25+ 扩展事件——它们是长任务 coding agent 的机制。

## 替代方案

- 只提高 `max_tokens`：不改「截断即全废」与「失败不可见」，问题变小但不会消失。
- 用 agent loop / 工具调用拿结构化输出（Pi 的 `structured_output` 工具模式）：需要引入循环与工具面，与单发定位冲突，成本大于收益。
- 客户端做解析与容错：把契约判断分散到前端，违背「复杂逻辑留后端」。
- 无限重试：成本不可控；一次有界修复已覆盖官方指出的空响应与截断两类。

## 影响

- 同一 prompt 现在走：截断分类 → 纠正重问 → 拿到精简结果；仍失败则在气泡里得到可执行的下一步建议，而不是「未生成有效结果」。
- 新增测试：`parseMaxTokens` / `describeOutcome` / `toClientDiagnostics` / 有界修复两条路径（首次成功、两次失败）。
- 建议参考：Pi 结构化输出与架构笔记（[structured outputs](https://raw.githubusercontent.com/gtesei/agentic_design_patterns/b849d3c0519761e00ea533432a78e0294b2c0b8e/foundational_design_patterns/11_structured_outputs/pi.md)、[architecture](https://raw.githubusercontent.com/yamsfeer/learning-pi-agent/main/notes/02-coding-agent-architecture.md)）。
