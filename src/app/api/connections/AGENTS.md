# connections/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- 连接凭据只在服务端解密和使用；客户端不接收密码。
- 连接池生命周期由 `pool-registry` 管理。
