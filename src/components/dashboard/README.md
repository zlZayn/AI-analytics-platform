# dashboard/ — 结果面板

- `result-panel.tsx`：查询结果统计条、复制 SQL 和图表配置面板。
- `result-panel.test.tsx`：验证受控/非受控 mapping 在重渲染后保持稳定。
- 被 `SessionView.tsx` 依赖；查询执行与错误状态由上层负责。
- 改动后必测：`result-panel.test.tsx` 与完整 `npm test`。
- 规则 → [AGENTS.md](AGENTS.md)。
