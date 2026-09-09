# components/ — UI 组件与结果呈现

- 职责：应用布局、工作台交互、结果视图、图表和可复用 UI。
- `workspace/`：会话工作台，详见 [workspace/README.md](workspace/README.md)。
- `dashboard/`：结果面板，详见 [dashboard/README.md](dashboard/README.md)。
- `charts/`：图表系统，详见 [charts/README.md](charts/README.md)。
- `layout/`：应用布局与连接上下文，详见 [layout/README.md](layout/README.md)。
- `r-workbench/`：R 分析工作台，详见 [r-workbench/README.md](r-workbench/README.md)。
- `ui/`：基础 UI 原语，详见 [ui/README.md](ui/README.md)。
- `SessionView.tsx`：结果区状态容器与洞察/探索/明细 Tabs。
- 变更影响路由：工作台状态改动 → [workspace/README.md](workspace/README.md) 与 [hooks/README.md](../hooks/README.md)。
- 工作约束 → [AGENTS.md](AGENTS.md)。
