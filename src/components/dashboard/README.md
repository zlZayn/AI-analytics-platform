# dashboard/ — 结果面板

- `result-panel.tsx`：查询结果统计条、复制 SQL 和图表配置面板。
- 测试：`__tests__/`（受控/非受控 mapping 在重渲染后保持稳定），覆盖范围见 [__tests__/README.md](__tests__/README.md)。
- 被 `SessionView.tsx` 依赖；查询执行与错误状态由上层负责。
- 改动后必测：`npx vitest run src/components/dashboard/__tests__` 与完整 `npm test`（约定见 [docs/testing.md](../../../docs/testing.md)）。
- 规则 → [AGENTS.md](AGENTS.md)。
