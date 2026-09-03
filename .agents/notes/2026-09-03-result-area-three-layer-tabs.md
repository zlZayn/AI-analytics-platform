# 决策：结果区三层视图化（洞察 / 探索 / 明细）（2026-09-03）

已实施：阶段 1 已落地并推送（结果区 Tabs 化超越原方案 A）

## 问题

结果区头部一行挤 4 个 10px 按钮 + R 分析入口；R 面板堆叠推长结果区；AI 多结果只消费第一条（InsightCard 闲置）。产品承诺「业务用户看结论」，现状交付「过程与代码」。

## 决策

- 结果区三层 Tabs（`ui/tabs` variant=line，Base UI `data-active`）：洞察（InsightCard 卡片流，AI 多结果全部消费，结论前置默认激活）/ 探索（ResultPanel 图表配置与渲染）/ 明细（table-view 虚拟滚动，复用图表系统 table 分发）
- 顶部工具条收敛为「导出 ▼」下拉（CSV / JSON / 复制 R 模板 / R 分析），保留全部 title 提示语（BOM 兼容说明等）
- 洞察为会话外临时状态（`insightItems` 局部 useState，不进 AnalysisSession）；新洞察到达由事件驱动切洞察 Tab（`sendAi` 成功后），点卡片执行切探索 Tab；第一条仍自动执行（延续现状流程，结论前置）
- Tab 面板 `keepMounted`（Base UI TabsPanel）：切换不丢图表配置局部状态
- R 工作台入口移入导出菜单，面板仍内嵌结果区底部

## 替代方案（强制）

- 方案 A（图表 / 数据表 / R 分析三 Tab）：已否决——R 是手段不是交互主体，业务用户不需要 R 代码入口
- 方案 B（移除图表 R-only）：杀死零代码价值，否决
- 洞察不自动执行、全部人工点选：增加「提问→出图」摩擦，否决（第一条自动执行保流）

## 影响

- `SessionView` / `result-toolbar` / `session-workspace` 改动；`sessionReducer`、`useSession`、`types/session.ts` 未动（洞察走局部 state）
- E2E 增加 AI 多洞察断言（mock /api/ai 返回 2 条 → 洞察 Tab → 执行 → 探索）
- 明细视图复用 Chart table 分发，未新增表组件