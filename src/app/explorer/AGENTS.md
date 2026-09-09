# explorer/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- Schema、预览请求通过 `fetchApi`；跨页执行必须调用 `buildWorkspaceUrl`。
- 预览取消和加载错误必须可见且不覆盖新请求。
