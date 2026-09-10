# __tests__/ — 规则层

继承上级规则，见 [../AGENTS.md](../AGENTS.md)。

- 组件测试用 jsdom + `createRoot`；重依赖（Monaco、WebR）用 `vi.mock` 隔离，不渲染真实实例。
- 断言交互结果与契约，不做类名/结构快照。
