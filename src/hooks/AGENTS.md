# hooks/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- Hook 只封装状态、副作用或可复用交互，不持有页面布局。
- `useSession` 的执行副作用必须保持幂等，避免 Strict Mode 重复请求。
- 测试与被测 Hook 同目录的 `__tests__/`。
