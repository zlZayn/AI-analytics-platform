# __tests__/ — 核心库测试

- 命名：测试文件与被测模块同名（`x.ts` → `x.test.ts`），便于从源文件直接定位。
- 覆盖范围（按类别）：
  - 查询链：编译、只读校验、标识符引用、执行与取消、连接池
  - 会话与导航：展示配置校验、渲染绑定、导航参数规范化、连接载荷、统一历史客户端（含旧浏览器记录导入）与时间线合并
  - 边界适配：客户端请求与统一响应、加密、Schema 迁移、Schema 与数据轮廓的 prompt 文本生成
  - AI：契约单一来源与运行时校验、上下文与可见范围声明、provider 配置/请求头/响应格式降级（一律注入 fake provider，禁止真实 API）
  - R：`r-bridge` 纯函数、`webr-client` 状态机、黑盒统计模板
  - 全局契约：亮色主题（防暗色分支回流）、启动脚本、版本 bump
- 运行：`npx vitest run src/lib/__tests__`（约定与 CI 见 [docs/verification.md](../../../docs/verification.md)）
- 被测模块与改动路由 → [../README.md](../README.md)；工作约束 → [AGENTS.md](AGENTS.md)
