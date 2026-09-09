# query/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- 查询执行只接受 SQL 白名单，统一交给 `query-engine`。
- history/saved/preview 子路由保持响应字段与共享类型一致。
