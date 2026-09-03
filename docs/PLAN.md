# 进行中计划（跨会话延续）

更新时间：2026-09-03

用途：WIP 手账，跨会话延续上下文。已完成内容与验证快照见 [implementation-status.md](implementation-status.md)；运行规则与活跃坑见 [../AGENTS.md](../AGENTS.md)，不重复列出。

## 未完成事项

### UIUX 方案 A（结果区 Tabs）待拍板

- 现状问题：导出按钮与 R 分析入口挤在同一结果工具行；R 面板堆叠在图表下方，整体偏挤
- 方案 A（推荐）：结果区改为单内容面板 + Tabs（图表 / 数据表 / R 分析），导出收敛为「下载」下拉
- 方案 B（已否决）：移除 10 种图表的零代码路径，R-only——杀死零代码价值
- 待定：Tab 布局与文案细节；拍板后实施并更新本文件与 AGENTS 待办

### P2：AI 生成 R 代码

- 形态：InsightItem 第三变体（`rCode` + `rCodeDescription`），确认后一键运行
- 阻塞条件：真实使用 R 工作台的反馈 ≥ 3 次（等待 P1 使用反馈），当前不满足
- 配套：JSON Schema anyOf 第三变体 + 提示词注入 + 确认再运行 UI

### 人工验收

- 真实只读 PostgreSQL 账号验证写拒绝 / 长查询取消 / 认证失效池清理 / 连接删除，见 [manual-acceptance.md](manual-acceptance.md)（含 R 工作台，第 5 节）

## 已知问题

- 运行期问题（旧构建产物、Monaco CDN、R.wasm 离线不可用等）见 AGENTS 活跃坑，此处不重复
- 自动化无法覆盖的外部验证（真实凭据、真实 AI provider json_schema 支持）见 [implementation-status.md](implementation-status.md)「仍需人工完成」

## 下一步

1. 拍板 UIUX 方案（A / C），实施后同步本文件与 [../AGENTS.md](../AGENTS.md)
2. 真实只读账号完成人工验收
3. 收集 R 工作台使用反馈，满足条件后启动 P2