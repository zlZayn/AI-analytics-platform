# AI Analytics Platform 架构说明

## 定位

通用型 AI 数据分析平台：接入任意 PostgreSQL，自然语言 → 结构化查询 → 安全执行 → 语义感知可视化。

## 设计哲学

- 状态是唯一真相，视图是状态的函数，操作是状态的转换（会话驱动架构核心）
- 边界：SQL/AI 负责业务语义与聚合，图表只做确定、可测试、可解释的展示变换
- 稳定性：接口必须提供加载、成功、空、失败、取消、重试状态，截断/采样显式提示，不允许静默丢失
- 视觉：唯一专业亮色体系，颜色全部由 `src/app/globals.css` 语义 token 管理，组件不维护第二套颜色；颜色不能作为唯一编码，图表必须提供 tooltip 与表格入口
- 推荐是建议不是隐式决策：首次结果保持表格，用户主动选择建议后才切换图表，字段映射始终可改
- 稳定性：接口必须覆盖加载、成功、空、失败、取消和重试；截断或采样必须返回元数据，不允许静默丢失
- R 分析是结果的第二消费通道：浏览器沙箱是约束而非缺陷，它迫使数据保持单向（只读流入，输出不回流）

## 核心流程（状态驱动）

用户提问 → `AnalysisSession` 承载 QuerySpec → `query-compiler` 编译参数化 SQL → `query-engine` 执行返回 SemanticDataset → `render-binder` 将数据绑定到 DisplayConfig → `SessionView` 渲染图表与警告。结果区另有导出分支（CSV/JSON/R 代码模板，`result-toolbar`）与 **R 分析分支**（`RWorkbench`：查询结果注入 `df`，WebR 运行 dplyr/ggplot2，输出 stdout/图像），均基于 `session.result` 只读消费。R 工作台状态（WebRClient 单例）独立于 AnalysisSession，不触发任何 Action。

状态转换集中在 `sessionReducer`（19 种 Action），副作用由 `useSession` 的三个 effect 驱动（querySpec 变化→编译；compiledSql 变化→执行；needs_recompile→判断重查）。workspace 页面直接渲染 `SessionWorkspace`（会话驱动版本为唯一实现）。

## 不变决策

- 查询只允许单条 SELECT/WITH，在 PostgreSQL 只读事务 + statement timeout 内执行，默认上限 5,000 行
- 平台元数据表（Prisma）与用户业务表分离；数据库名 `ai_analytics` 保持，见 [决策记录](../.agents/notes/2026-09-01-keep-database-name-ai-analytics.md)
- AI 输出优先结构化 QuerySpec + DisplayConfig（双变体 anyOf），`sql` 字段作为回退；优先要求供应商原生 strict JSON Schema，提供方不支持时按 `json_object` → 无 `response_format` 降级，运行时契约校验（parseInsightItems + validators）始终执行；SQL 只引用当前 Schema 与显式输出别名
- 连接密码 AES-256 加密（每条随机盐）；AI 与数据库凭据只从环境变量读取，不落库
- Geist 字体自托管（`src/app/fonts/` via `next/font/local`）；构建与开发不访问外网字体服务
- 入口脚本构建新鲜度检查：`src`/`prisma`（排除 `generated`）vs `.next/BUILD_ID`；构建后若端口已有旧服务，`Start Dev.cmd` 先结束旧 PID 再启动新实例
- 工作台导航 URL 由 `lib/workspace-navigation.ts` 统一生成；SQL 统一规范化换行、编码并保留 connection；探索与查询管理入口使用完整文档导航，避免生产 App Router 客户端转换丢失第二个查询参数；工作台按 `connection + SQL` key 一次性应用导航 payload，再进入统一执行管线
- API 统一 `ApiResponse<T>` + requestId；客户端统一处理 HTTP、非 JSON、超时、Abort
- 图表变换全部确定性；统计计算（相关矩阵、直方图分箱）在可取消 Worker 中执行
- 数据轮廓扫描（最多 6 表）注入 AI 提示词，失败不阻断主流程
- R 分析工作台：数据只从 `session.result` 单向流入（`r-bridge` 纯函数 → WebR），R 输出不回写 AnalysisSession；WebR 实例为模块级单例（`useWebR`），SAB 通道 + COI 头；R.wasm 与 R 包从 `webr.r-wasm.org` 按需下载，离线不可用

## 校验体系（统一到 validators.ts）

双模式校验 `validateDisplayConfig(config, context, mode)`：

| 模式 | 场景 | 校验内容 |
|------|------|---------|
| schema-based | INIT_FROM_AI 后 | 字段存在 + 类型匹配 |
| data-based | EXECUTE_SUCCESS / UPDATE_DISPLAY_CONFIG | 上述 + 重复坐标 + 无效数值 + 高基数 |

## 防错清单

- 颜色唯一来源是 globals.css 语义 token，组件不得自建颜色常量
- 结果表窗口化渲染（容器实测高度驱动虚拟窗口）、粘性表头、NULL 标记、列宽持久化、键盘滚动
- 数据表单一 owner：表格归结果区「明细」独占（读原始查询行），探索的 `table` 是未选择图表的哨兵值，不重复渲染
- 布局可拖拽：工作台纵向（SQL 编辑器高度）、工作台横向（AI 助手与结果区宽度）、R 面板纵向（代码与输出）共用同一 `SplitHandle` 与 `SPLIT_PRESETS`（`lib/split.ts`），比例本地记忆，窄屏不显示句柄
- 结果工具条分层：导出 = 带走数据或代码（CSV / JSON / R 模板），**R 分析 = 就地分析的一级动作**，不塞进导出菜单
- R 分析以**右侧停靠面板**呈现（`fixed`，不占用结果区 flex 流；关闭即平移出屏但保持挂载以保留代码与输出），代码/输出高度可拖拽并持久化
- AI 输出预算覆盖推理开销（`AI_MAX_TOKENS`，推理 token 也计入）；解析失败只做一次有界修复，失败分类与用户可读提示由后端给出（前端不做判断）
- 执行入口唯一落地：编辑器执行、导航带 SQL、洞察卡片执行都必须经 `SET_COMPILED_SQL` 真正发起一次执行；会话用 `runId` 标记显式执行请求，编译去重不得吞掉执行意图
- 工作台按连接持久化会话骨架与洞察流（`lib/workspace-store.ts`，sessionStorage）：不持久化结果行，瞬态状态（compiling/executing）恢复为 ready；恢复不带 compiledSql/querySpec（否则进入即自动重跑），持久化立即写不防抖（卸载时 cleanup 会取消定时器）
- 工作台桌面双栏、窄屏纵向滚动；SQL/AI/结果区各自保持稳定最小尺寸；结果区固定外框并统一承载等待、执行中、成功、失败、洞察、探索、明细状态，执行状态使用可访问的实时提示
- 图表错误边界自动重置 + 手动重试，保留上一次成功结果
- 连接池：有限 PoolRegistry、并发创建去重、闲置/LRU 回收、认证错误失效
- 每次文档同步后跑链接校验（scripts/check-links.py），引用不写死本机路径

## 文档约定

- 分层：README=用法，AGENTS.md=维护索引，本文件=设计决策，.agents/notes/=决策记录
- 详细接口：见 [api.md](api.md)；AI 合同：[04_ai_integration.md](04_ai_integration.md)
- 项目结构、页面路由清单：见 [src/README.md](../src/README.md)；API 路由总表：[api.md](api.md)
