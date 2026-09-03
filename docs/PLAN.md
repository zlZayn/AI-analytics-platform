# 进行中计划（跨会话延续）

更新时间：2026-09-03

用途：WIP 手账，跨会话延续上下文。已完成内容与验证快照见 [implementation-status.md](implementation-status.md)；运行规则与活跃坑见 [../AGENTS.md](../AGENTS.md)，不重复列出。

## 未完成事项

### 人工验收

- 真实只读 PostgreSQL 账号验证写拒绝 / 长查询取消 / 认证失效池清理 / 连接删除，见 [manual-acceptance.md](manual-acceptance.md)（含 R 工作台，第 5 节）
- 真实 AI provider 验收：strict json_schema 对新增 `context`/`statTest` 字段的输出符合性

### 可选增强（蓝图阶段 4 剩余）

- R.wasm Service Worker 预加载 / requestIdleCallback 预热（当前按需加载）
- statTest 黑盒统计的真实 R 浏览器端实测（离线 E2E 只验证了错误路径，成功路径需联网）

## 已拍板决策

- 结果区三层 Tabs（洞察/探索/明细）：阶段 1 已实施，见 [决策记录](../.agents/notes/2026-09-03-result-area-three-layer-tabs.md)
- WebR 黑盒统计引擎（固定模板，替代 AI 直接生成 R）：阶段 3 已实施，见 [决策记录](../.agents/notes/2026-09-03-webr-blackbox-stat-engine.md)

## 已知问题

- 运行期问题（旧构建产物、Monaco CDN、R.wasm 离线不可用等）见 AGENTS 活跃坑，此处不重复
- 自动化无法覆盖的外部验证（真实凭据、真实 AI provider json_schema 支持）见 [implementation-status.md](implementation-status.md)「仍需人工完成」

## 下一步

1. 真实只读账号完成人工验收
2. 联网环境实测 statTest 成功路径与 InsightCard 统计区块
3. 按需实施 R.wasm 预加载优化