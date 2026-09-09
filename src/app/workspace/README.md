# workspace/ — 工作台路由

- `page.tsx`：读取连接与初始 SQL 查询参数，挂载 `SessionWorkspace`。
- `connection + sql` 变化会创建新的会话实例，确保入口 payload 不残留。
