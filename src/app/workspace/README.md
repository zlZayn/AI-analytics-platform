# workspace/ — 工作台路由

- `page.tsx`：读取连接、初始 SQL 与可选的 R 历史回放 id（`?r=`）查询参数，挂载 `SessionWorkspace`。
- `connection + sql + r` 变化会创建新的会话实例，确保入口 payload 不残留。
