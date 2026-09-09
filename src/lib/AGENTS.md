# lib/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- 纯逻辑优先使用纯函数并配套同目录测试。
- API/数据库边界保持统一响应、SQL 只读校验和连接池安全约束。
- 导航参数由 `workspace-navigation.ts` 集中规范化，不在页面重复编码。
