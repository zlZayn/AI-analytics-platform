# 进行中计划（跨会话延续）

更新时间：2026-09-03

用途：WIP 手账，跨会话延续上下文。已完成内容与验证快照见 [implementation-status.md](implementation-status.md)；运行规则与活跃坑见 [../AGENTS.md](../AGENTS.md)，不重复列出。

## 未完成事项

### 蓝图阶段 2：AI 多洞察 + 业务上下文注入

- 扩张 InsightItem（`context` 字段 + RAG 业务口径注入接口预留）
- 更新 AiVisibilityHint 文案
- 依赖 ai-contract.ts 扩展（P2 可动文件）

### 蓝图阶段 3：WebR 黑盒统计引擎

- 最小可行版：固定模板执行 t.test/cor.test（包白名单），AI 意图接线
- 原 P2（AI 生成 R 代码给用户运行）已被蓝图升维取代，路径改为黑盒化

### 蓝图阶段 4：体验打磨

- @mention 中文分词（光标回溯替代 `\s+` 分词）
- toast / R 状态栏 aria-live、@ 面板角色补齐
- R.wasm 预加载（可选）

### 人工验收

- 真实只读 PostgreSQL 账号验证写拒绝 / 长查询取消 / 认证失效池清理 / 连接删除，见 [manual-acceptance.md](manual-acceptance.md)（含 R 工作台，第 5 节）

## 已拍板决策

- UIUX 方案 A 升级为「结果区三层 Tabs」（洞察 / 探索 / 明细）：阶段 1 已实施；决策理由与替代方案见 [决策记录](../.agents/notes/2026-09-03-result-area-three-layer-tabs.md)

## 已知问题

- 运行期问题（旧构建产物、Monaco CDN、R.wasm 离线不可用等）见 AGENTS 活跃坑，此处不重复
- 自动化无法覆盖的外部验证（真实凭据、真实 AI provider json_schema 支持）见 [implementation-status.md](implementation-status.md)「仍需人工完成」

## 下一步

1. 阶段 2（多洞察 context + 上下文注入接口预留）
2. 阶段 3（WebR 统计引擎最小版）
3. 阶段 4（@ 分词 + aria）
4. 真实只读账号完成人工验收