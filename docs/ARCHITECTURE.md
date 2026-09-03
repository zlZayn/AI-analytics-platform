# AI Analytics Platform 架构说明

## 定位

通用型 AI 数据分析平台：接入任意 PostgreSQL，自然语言 → 结构化查询 → 安全执行 → 语义感知可视化。

## 设计哲学

- 状态是唯一真相，视图是状态的函数，操作是状态的转换（重构核心，见 [REFACTOR_PLAN_v4.md](REFACTOR_PLAN_v4.md)）
- 边界：SQL/AI 负责业务语义与聚合，图表只做确定、可测试、可解释的展示变换
- 稳定性：接口必须提供加载、成功、空、失败、取消、重试状态，截断/采样显式提示，不允许静默丢失
- 视觉：唯一专业亮色体系，颜色全部由 `src/app/globals.css` 语义 token 管理，组件不维护第二套颜色
- 哲学细节：见 [design-philosophy.md](design-philosophy.md)

## 核心流程（状态驱动）

用户提问 → `AnalysisSession` 承载 QuerySpec → `query-compiler` 编译参数化 SQL → `query-engine` 执行返回 SemanticDataset → `render-binder` 将数据绑定到 DisplayConfig → `SessionView` 渲染图表与警告。

状态转换集中在 `sessionReducer`（19 种 Action），副作用由 `useSession` 的三个 effect 驱动（querySpec 变化→编译；compiledSql 变化→执行；needs_recompile→判断重查）。workspace 页面直接渲染 `SessionWorkspace`（会话驱动版本为唯一实现）。

## 不变决策

- 查询只允许单条 SELECT/WITH，在 PostgreSQL 只读事务 + statement timeout 内执行，默认上限 5,000 行
- 平台元数据表（Prisma）与用户业务表分离；数据库名 `ai_analytics` 保持，见 [决策记录](../.agents/notes/2026-09-01-keep-database-name-ai-analytics.md)
- AI 输出优先结构化 QuerySpec + DisplayConfig（双变体 anyOf），`sql` 字段作为回退；AI 输出使用供应商原生 strict JSON Schema + 运行时校验；SQL 只引用当前 Schema 与显式输出别名
- 连接密码 AES-256 加密（每条随机盐）；AI 与数据库凭据只从环境变量读取，不落库
- Geist 字体自托管（`src/app/fonts/` via `next/font/local`）；构建与开发不访问外网字体服务
- 入口脚本构建新鲜度检查：`src`/`prisma`（排除 `generated`）vs `.next/BUILD_ID`，最新即跳过构建
- API 统一 `ApiResponse<T>` + requestId；客户端统一处理 HTTP、非 JSON、超时、Abort
- 图表变换全部确定性；统计计算（相关矩阵、直方图分箱）在可取消 Worker 中执行
- 数据轮廓扫描（最多 6 表）注入 AI 提示词，失败不阻断主流程

## 校验体系（统一到 validators.ts）

双模式校验 `validateDisplayConfig(config, context, mode)`：

| 模式 | 场景 | 校验内容 |
|------|------|---------|
| schema-based | INIT_FROM_AI 后 | 字段存在 + 类型匹配 |
| data-based | EXECUTE_SUCCESS / UPDATE_DISPLAY_CONFIG | 上述 + 重复坐标 + 无效数值 + 高基数 |

## 防错清单

- 颜色唯一来源是 globals.css 语义 token，组件不得自建颜色常量
- 结果表窗口化渲染、粘性表头、NULL 标记、列宽持久化、键盘滚动
- 图表错误边界自动重置 + 手动重试，保留上一次成功结果
- 连接池：有限 PoolRegistry、并发创建去重、闲置/LRU 回收、认证错误失效
- 每次文档同步后跑链接校验（scripts/check-links.py），引用不写死本机路径

## 文档约定

- 分层：README=用法，AGENTS.md=维护索引，本文件=设计决策，.agents/notes/=决策记录
- 详细接口：见 [api.md](api.md)；图表算法：[charts.md](charts.md)；AI 合同：[04_ai_integration.md](04_ai_integration.md)
- 项目结构、页面与 API 路由清单：见 [README.md](../README.md)