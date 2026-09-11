# 决策：工作台执行生命周期（2026-09-04）

> 已归档（2026-09-11）：执行契约已被 [2026-09-11-unified-run-contract-and-workspace-persistence.md](../2026-09-11-unified-run-contract-and-workspace-persistence.md) 取代；仍生效的只有 `.cmd` 圆括号约束与构建后重启行为。

已实施/已否决：已实施

## 问题

构建后启动入口可能继续复用旧的 `next start` 进程；跨页面入口各自拼接 URL；React Strict Mode 可能重复触发初始 SQL effect；重启日志中的圆括号会被 CMD 误解析。

## 决策

- `Start Dev.cmd` 在构建成功后结束占用端口的旧 PID，再启动新实例。
- `/explorer` 与 `/queries` 使用 `buildWorkspaceUrl` 生成统一 URL。
- 初始 SQL effect 以 ref 标记只应用一次；compiled SQL 执行以对象身份防重复启动。
- `if (...)` 代码块中的日志不使用未转义圆括号，避免 `was unexpected at this time`。

## 替代方案

- 仅刷新浏览器：不能替换已加载旧构建的服务进程。
- 在每个页面继续手写 URL：编码规则会再次分叉。
- 禁用 React Strict Mode：隐藏重复 effect，不能修复真实生命周期问题。
- 在代码块日志中保留圆括号：CMD 将其视为控制语法，启动失败。

## 影响

构建后页面始终由新实例提供；导航参数行为集中可测；手动执行仍通过创建新 compiled SQL 对象触发重跑。
