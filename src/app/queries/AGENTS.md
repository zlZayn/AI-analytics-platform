# queries/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- 收藏和历史数据通过 API 加载；执行入口统一调用 `buildWorkspaceUrl`（历史时间线用 `buildHistoryWorkspaceUrl`）。
- 历史标签渲染合并时间线（`lib/history-merge.ts`），组件不自己合并、不绕过 `lib/history-client.ts` 直连历史接口。
- 删除操作必须有失败提示，不静默改变列表。
