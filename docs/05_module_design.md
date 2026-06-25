# 模块设计文档

## 一、模块总览

| 模块 | 文件 | 职责 |
| :--- | :--- | :--- |
| AI Service | `lib/ai-service.ts` | 自然语言 -> SQL 生成 |
| Query Engine | `lib/query-engine.ts` | 连接池管理 + SQL 执行 |
| Schema Service | `lib/schema-service.ts` | 数据库结构扫描 + AI 上下文构建 |
| SQL Validator | `lib/sql-validator.ts` | SQL 安全校验 (白名单) |
| Variable Types | `lib/variable-types.ts` | 变量类型推断 + 图表映射 |
| Encryption | `lib/encryption.ts` | AES-256 密码加密/解密 |
| Prisma Client | `lib/prisma.ts` | Prisma 单例客户端 |
| Chart System | `components/charts/` | 9 种图表视图 + 图标 |
| Chart Config | `components/chart-config-panel.tsx` | ggplot2 风格图表配置面板 |
| Result Panel | `components/dashboard/result-panel.tsx` | 查询结果展示 |
| Toast | `components/toast.tsx` | 操作反馈通知 |
| Layout | `components/layout/` | 侧边栏 + 连接上下文 |
| Shared Types | `types/index.ts` | TypeScript 类型定义 |

---

## 二、核心库

### AI Service (`lib/ai-service.ts`)

调用 OpenAI 兼容 API，将自然语言转换为 SQL。

- System Prompt 包含星型模型业务上下文
- 输出格式: 说明文字 + SQL (不要代码块)
- 支持多轮对话历史

### Query Engine (`lib/query-engine.ts`)

管理数据库连接池，执行 SQL 查询。

- 连接池按 connectionId 缓存
- 密码解密后创建连接
- 超时控制 (默认 30s)
- PG 类型 OID 映射

### Schema Service (`lib/schema-service.ts`)

扫描 PostgreSQL 数据库结构，缓存 Schema 快照。

- 查询 information_schema 获取表/列/外键
- 排除平台元数据表
- Schema 快照缓存到 SchemaSnapshot 表
- buildSchemaContext 生成 AI 上下文文本

### SQL Validator (`lib/sql-validator.ts`)

校验 SQL 安全性，防止危险操作。

- 只允许: SELECT, WITH, EXPLAIN, ANALYZE
- 禁止: DROP, DELETE, UPDATE, INSERT, ALTER, CREATE
- 自动添加 LIMIT 1000

### Variable Types (`lib/variable-types.ts`)

推断变量类型，支持 ggplot2 风格的图表映射。

- 变量角色: temporal / categorical / continuous / binary / id
- 图表映射槽位: line, bar, pie, scatter, histogram, boxplot, correlation
- 相关系数: Pearson / Spearman / Kendall

### Encryption (`lib/encryption.ts`)

AES-256-GCM 加密/解密数据库连接密码。

---

## 三、组件

### Chart System (`components/charts/`)

9 种图表类型，模块化设计。

| 类型 | 组件 | 说明 |
| :--- | :--- | :--- |
| line | LineChartView | 折线图 |
| bar | BarChartView | 柱状图 |
| pie | PieChartView | 饼图 (分组聚合) |
| scatter | ScatterChartView | 散点图 |
| histogram | HistogramView | 直方图 (Freedman-Diaconis) |
| boxplot | BoxPlotView | 箱线图 (自绘 SVG) |
| heatmap | HeatmapView | 热力图 (自绘 SVG) |
| correlation | CorrelationHeatmap | 相关系数矩阵 |
| table | TableView | 数据表格 |

### Chart Config Panel (`components/chart-config-panel.tsx`)

ggplot2 风格的图表配置界面。

- 图表类型选择器 (SVG 图标)
- 映射槽位下拉选择 (自定义 DropdownSelect)
- 变量信息卡片 (类型/统计/样本)
- 图表渲染

### Result Panel (`components/dashboard/result-panel.tsx`)

查询结果展示面板。

- 状态栏 (行数/耗时/列数/复制 SQL)
- 内嵌 ChartConfigPanel

### Toast (`components/toast.tsx`)

操作反馈通知系统。

- Context Provider + useToast hook
- 3 种类型: success / error / info
- 3 秒自动消失

---

## 四、布局

### AppShell (`components/layout/app-shell.tsx`)

顶层布局: Suspense + ToastProvider + ConnectionProvider + Sidebar + Main。

### Sidebar (`components/layout/sidebar.tsx`)

左侧导航: Logo + 连接信息 + 3 个导航项 + 版本号。

### ConnectionProvider (`components/layout/connection-context.tsx`)

React Context: 从 URL 读取 `?connection=xxx`，加载连接信息。

---

## 五、类型定义 (`types/index.ts`)

| 类型 | 说明 |
| :--- | :--- |
| Connection | 数据库连接 |
| QueryResult | 查询结果 (columns/rows/rowCount/executionTimeMs) |
| SchemaTable | 表结构 (name/columns/rowEstimate) |
| SchemaRelation | 表关联 (fromTable/fromColumn/toTable/toColumn) |
| SchemaData | Schema 数据 (tables/relations/version) |
| QueryHistoryItem | 查询历史 |
| SavedQuery | 保存的查询 |
| ApiResponse | API 响应 (success/data/error) |

---

*文档版本: v1.20.0*
*最后更新: 2026-06-25*
