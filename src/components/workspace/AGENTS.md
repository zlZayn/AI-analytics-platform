# workspace/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- `SessionWorkspace` 是工作台唯一实现；执行必须进入 `useSession`/`sessionReducer` 管线。
- 初始 SQL 只接受 `workspace-navigation.ts` 规范化后的 payload，并按 key 幂等应用。
- 不在组件内复制 API、导航或会话状态逻辑。
