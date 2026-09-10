# components/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- 组件状态必须有明确 owner；跨组件状态通过 props 或 session/action 传递。
- 颜色只用 `app/globals.css` 语义 token。
- 组件测试放同级 `__tests__/`（重依赖用 `vi.mock` 隔离，不渲染真实 Monaco/WebR）；覆盖范围与运行方式见 [__tests__/README.md](__tests__/README.md)。
- 组件职责与变更路由见 [README.md](README.md)。
