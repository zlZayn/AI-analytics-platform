# 测试约定

纯算法和请求封装使用 Vitest；组件和关键流程使用 Testing Library/Playwright。算法测试必须覆盖空值、非有限值、常量列、并列值、重复坐标、极端值和大数据边界。

关键回归场景包括查询超时、查询取消、5,000 行截断、连接池失效、Schema 刷新、非 JSON API 错误、快速切换表、亮色视觉一致性和窄屏布局。`light-theme-contract.test.ts` 防止主题切换入口、暗色初始化逻辑和 `dark:*` 样式重新进入项目。完成前运行 `npm run typecheck`、`npm run lint`、`npm test` 和 `npm run build`。
