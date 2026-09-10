# 决策：数据表单一 owner（明细独占表格 / 探索只负责出图）（2026-09-11）

已实施：已落地并同步单测、离线 E2E 与文档

## 问题

- 「探索」的图表类型含 `table`，「明细」Tab 又渲染同一个 `table-view`，两处渲染同一份 `bound.rows`。
- 默认执行路径（`runSql`、导航入口、AI 契约「首次结果保持表格」）都写入 `chartType: "table"`，两个 Tab 的内容因此完全相同。
- 明细取 `bindDataToChart(result, displayConfig).rows`（图表绑定投影），选定带数值槽位的图表类型后无效数值行被过滤，明细行数少于查询返回行数。
- 表格被 `max-h-[400px]` 限高，作为唯一数据面时结果区近半空间闲置。

## 决策

- 数据表只有一个 owner：`table` 从 `SELECTABLE_CHART_TYPES` 移除，探索的类型网格不再枚举它。
- `table` 保留为「未选择图表」的哨兵值：会话默认、导航执行、AI 回退继续写入 `chartType: "table"`。
- 探索在哨兵态渲染图表引导（`data-testid="chart-guide"`：推荐图表按钮 + 指向明细的说明），不渲染图表表面。
- `chart-surface` 只在选定真实图表类型时存在。
- 明细读 `result.rows`（原始查询行），不经过 `render-binder`。
- `Chart` 新增 `fillHeight`，`TableView` 以容器实测高度驱动虚拟窗口并撑满结果区。
- 结果区面板布局收敛为两条契约：`PANEL_SCROLL`（内容自发滚动：洞察、探索）与 `PANEL_FILL`（内容撑满：明细）。
- 「可用列」参考信息默认折叠（原生 `details`），纵向空间让给图表。

## 替代方案

- 三层 Tabs 合并为两层（洞察 / 数据，内部切换图表｜表格）：Tab 条更干净，但两个入口仍渲染同一表格，根因未消除，切换控件下移且改动面更大。
- 只把明细数据源改回 `result.rows` 并保留双表格：修掉语义错误，冗余与「图表被配置顶出视口」仍在。
- 两份表格差异化（行号、排序、复制）：两份表仍需同步维护，冗余成本长期存在。

## 影响

- 表格态不再出现第二份数据表；明细始终等于查询返回行。
- 单测：`variable-types.test.ts`（可选项契约）、`chart-config-panel.test.tsx`（引导 / 类型清单 / 折叠）、`SessionView.test.tsx`（明细原始行、探索引导与渲染）。
- 离线 E2E：导航入口断言 `chart-guide`，图表类型清单去掉「表格」，新增明细 4 行与空值行断言。
- 未纳入本轮：图表视图高度固定 320px，配置项较多时探索面板仍需滚动；统一图表高度契约（`ResponsiveContainer height="100%"` + 弹性表面）留作独立改动。
