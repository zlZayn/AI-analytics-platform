# __tests__/ — 组件合同测试

- 覆盖范围（按类别）：
  - 结果区容器（`SessionView`）：面板滚动/填充契约、明细与探索的数据来源差异、图表引导
  - 图表配置面板（`chart-config-panel`）：表格态引导、类型清单、参考信息折叠
  - 洞察卡片（`insight-card`）：展开、执行与统计区块
  - AI 助手面板（`ai-assistant-panel`）：占位文案与「重置」出现条件、重置只转回调、busy/asking 禁用、未配置时的 .env 指引、user/assistant 气泡分区、思考中提示、发送键的禁用与转调
- 运行：`npx vitest run src/components/__tests__`（约定与 CI 见 [docs/verification.md](../../../docs/verification.md)）
- 被测模块与改动路由 → [../README.md](../README.md)；工作约束 → [AGENTS.md](AGENTS.md)
