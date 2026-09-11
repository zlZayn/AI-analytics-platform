# 运维 — 运行参数、密钥与数据隔离

- 定位：部署与运行时的唯一事实来源（参数、限额、密钥、隔离）；对外接口语义见 [api.md](api.md)。

## 运行时与工具链基线

- Node 基线 **22**：唯一来源是 [`.node-version`](../.node-version)（fnm/asdf/mise/nodenv 读它），CI 用 `node-version-file` 读同一文件，`package.json` 的 `engines.node` 为 `>=22 <25`——升基线只改这三处并同步 README 徽章。
- 本机 Node 24 仍在 `engines` 允许区间内，但**验收以 CI 的 Node 22 为准**；本地与 CI 结果不一致时先核对版本。
- 包管理固定 npm + 单一 `package-lock.json`（lockfileVersion 3）：CI 用 `npm ci`，锁文件与 `package.json` 不一致即失败；升级依赖走 PR 而不是本地手改锁文件。
- 生命周期脚本：npm 12 默认拦截依赖的 pre/postinstall（本项目当前依赖被拦截时仍可构建、测试、运行），npm 10（Node 22 自带）会执行它们——两边都验证过，差异与取舍见决策记录。

## 连接池与并发

- 连接池注册表最多保留 12 个连接池，支持并发创建去重、5 分钟闲置回收和 LRU 淘汰。
- 连接配置变更、删除或不可恢复认证错误必须调用失效清理（接口语义见 [api.md](api.md)「连接与 Schema」）。
- 查询超时由 PostgreSQL `statement_timeout` 负责；HTTP Abort 会通过独立连接调用 `pg_cancel_backend`，确认原查询结束后才回滚并释放 client。

## 运行参数与限额

| 参数 | 值 | 说明 |
| :--- | :--- | :--- |
| 查询默认行上限 `rowLimit` | 5,000 | 服务端额外读取一行判断 `truncated`；响应字段见 [api.md](api.md) |
| 查询默认超时 | 10 秒 | 由 `statement_timeout` 执行 |
| 查询最大超时 | 60 秒 | 超出请求被拒 |
| 探索表预览上限 | 100 行 | `/api/query/preview` 固定值，客户端不得拼接 SQL |

调整这些常量时必须同步 API 响应说明、负载测试和用户提示。

## 日志与可观测

- 日志使用 requestId 关联客户端错误和服务端异常；向用户隐藏密码、连接字符串和数据库堆栈。
- Schema 快照只保留一个 active 版本，历史版本用于审计和问题定位。

## 加密密钥生命周期

- `ENCRYPTION_KEY` 为必填项，至少 32 字符；部署前使用安全随机数生成器创建，并通过密钥管理系统注入。
- 已保存连接的密码使用该密钥加密。更换或丢失密钥后旧记录无法解密，因此常规部署必须保持稳定。
- 新密文采用 `salt:iv:authTag:ciphertext`，每次加密生成独立 16 字节随机盐；解密器兼容旧版固定盐的三段密文，编辑并保存连接后会自动写成新格式。
- 从曾使用公开默认密钥的旧版本升级时，不要依赖旧密文迁移：先轮换外部数据库密码，部署新密钥，再在界面重新录入各连接密码。
- 泄露过的 AI Key、数据库密码和加密密钥必须在对应供应商或数据库侧撤销；删除 Git 文件不能使历史凭据失效。

## 测试数据隔离

`scripts/seed.py` 只接受 `SEED_DATABASE_URL`，故意不回退到应用 `DATABASE_URL`。种子账号和目标库应独立于生产环境，并允许创建测试表和写入测试数据。

## 相关文档

- 对外接口 [api.md](api.md) · 设计决策 [ARCHITECTURE.md](ARCHITECTURE.md) · 元数据表与 schema 演进 [prisma/README.md](../prisma/README.md) · 使用入口 [README.md](../README.md)
