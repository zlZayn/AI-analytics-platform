# queries/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- 收藏和历史数据通过 API 加载；执行入口统一调用 `buildWorkspaceUrl`。
- 删除操作必须有失败提示，不静默改变列表。
