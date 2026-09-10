# charts/ — 图表系统

- `pipeline.ts` / `mapping.ts`：数据画像、推荐和映射生成。
- `algorithms.ts` / `transform.ts`：可测试的统计与展示变换。
- `views/`：各图表类型渲染器，详见 [views/README.md](views/README.md)。
- `hooks/`：展示 Hook，详见 [hooks/README.md](hooks/README.md)。
- `__tests__/`：测试，详见 [__tests__/README.md](__tests__/README.md)。

## 类型与分发

- 类型清单的唯一来源是 `src/lib/variable-types.ts`：`CHART_TYPE_INFO`（全部类型）与 `SELECTABLE_CHART_TYPES`（探索面板可选项，不含 `table`）。
- `table` 是「未选择图表」的哨兵值：数据表由结果区「明细」Tab 独占，见 [决策记录](../../../.agents/notes/2026-09-11-detail-table-single-owner.md)。
- 数据管线：`profileData → recommendCharts → createMappingForChart → validateChartMapping → Chart 组件`。

## 固定算法

- 直方图：Freedman–Diaconis 分箱，IQR 为零回退 Sturges，箱数限制 5–50。
- 箱线图：Hyndman–Fan Type 7 四分位数，须线取 1.5×IQR 范围内实际最远值。
- 相关系数：Pearson / Spearman（并列取平均秩）/ Kendall tau-b（Fenwick Tree，`O(n log n)`）逐对删除缺失值；常量列与样本不足返回不可计算；相关矩阵在 Worker 执行，输入变化终止旧任务。
- 折线时间轴按解析时间排序且 `connectNulls=false`，类别轴保留输入顺序。
- 柱状图 grouped / stacked / normalized 只由用户显式选择，不按组数自动变化。
- 色阶：全非负用顺序色阶，含负值用以零为中心的发散色阶，缺失格用独立 token；所有颜色引用 `src/app/globals.css` 的图表语义 token，组件不硬编码。

## 显示边界

- 查询默认最多 5,000 行；数据表 32px 行高窗口化渲染（`fillHeight` 时按容器实测高度计算窗口），列宽限制 96–360px 并本地持久化。
- 散点图超过 2,000 点确定性采样并提示；相关矩阵最多 20 个数值列；饼图默认最多 8 类，其余显式标记为「其他」；热力图最多 20 个唯一值。

## 容器宽度与错误防御

- 宽度策略三档：Recharts 系 `ResponsiveContainer width="100%" height={320}`；boxplot 用 `useContainerWidth`（ResizeObserver）；heatmap / correlation 固定像素 svg + 外层横向滚动。
- 错误防御三层：空数据 → `EmptyState`；配置缺失或 transform 失败 → 中文 `EmptyState`；渲染异常 → `ChartErrorBoundary`（`resetKeysChanged` 自动复位 + 手动重试）。

## 已知问题（待清理）

- 直方图的 `mapping.color` 定义后未分发（`index.tsx` 只传 `valueKey`）。
- 空态高度不统一（histogram 280px，其余 320px）；KPI delta 为 0 时仍显示「↑ 0.0%」。
- 数据表 End 键滚到底未减视口高度；列宽 localStorage key 随列组合累积。
