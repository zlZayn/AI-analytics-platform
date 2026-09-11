# __tests__/ — 规则层

继承上级规则，见 [../AGENTS.md](../AGENTS.md)。

- 用 jsdom + `createRoot` 渲染面板，`useWebR` 与 Monaco 一律 mock，不渲染真实 WebR 运行时。
- 断言动作契约（调了哪个动作、传了什么代码、先后顺序），不断言类名与结构。
