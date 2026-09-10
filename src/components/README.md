# components/ — UI 组件与结果呈现

- 职责：应用布局、工作台交互、结果视图、图表和可复用 UI。
- `workspace/`：会话工作台，详见 [workspace/README.md](workspace/README.md)。
- `dashboard/`：结果面板，详见 [dashboard/README.md](dashboard/README.md)。
- `charts/`：图表系统，详见 [charts/README.md](charts/README.md)。
- `layout/`：应用布局与连接上下文，详见 [layout/README.md](layout/README.md)。
- `r-workbench/`：R 分析工作台，详见 [r-workbench/README.md](r-workbench/README.md)。
- `ui/`：基础 UI 原语，详见 [ui/README.md](ui/README.md)。
- `SessionView.tsx`：结果区状态容器与洞察/探索/明细 Tabs（面板滚动/填充契约，数据表归明细独占）。
- `chart-config-panel.tsx`：图表引导（表格态）、类型选择与槽位映射；类型清单来自 `lib/variable-types.ts`。
- `result-toolbar.tsx`：结果区「导出 ▼」下拉（导出 CSV / JSON、复制 R 模板、R 分析），title 提示语含 BOM 与兼容性说明，改动时保留。
- `insight-card.tsx`：AI 洞察卡片（标题、说明、SQL 展开、执行、统计区块）。
- `ai-mention-input.tsx` / `ai-mention-panel.tsx`：@ 选表输入与面板；`ai-visibility-hint.tsx`：AI 可见范围提示，内容由 `lib/ai-context.ts` 的 `CONTEXT_SOURCES` 声明渲染（与提示词注入同一来源）。
- 变更影响路由：工作台状态改动 → [workspace/README.md](workspace/README.md) 与 [hooks/README.md](../hooks/README.md)。
- 工作约束 → [AGENTS.md](AGENTS.md)。
