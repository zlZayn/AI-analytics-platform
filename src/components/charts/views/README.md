# views/ — 图表视图

- 包含表格、指标卡、直方图、折线、柱状、饼图、散点、箱线和热力视图。
- 统一由 `components/charts/index.tsx` 分发。
- `table-view.tsx`：虚拟滚动数据表；`fillHeight` 按容器实测高度计算窗口（无法实测时回落 400px）。
