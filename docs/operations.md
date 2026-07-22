# 运维说明

连接池按连接 ID 缓存，连接配置变更或删除时必须调用失效清理。查询超时由 PostgreSQL statement timeout 负责，应用层不能用 Promise race 假装取消。

日志使用 requestId 关联客户端错误和服务端异常；向用户隐藏密码、连接字符串和数据库堆栈。Schema 快照只保留一个 active 版本，历史版本用于审计和问题定位。
