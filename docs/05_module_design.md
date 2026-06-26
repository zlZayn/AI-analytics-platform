# 模块设计文档

## 一、模块总览

| 模块 | 文件 | 职责 |
| :--- | :--- | :--- |
| AI Service | `lib/ai-service.ts` | 自然语言 -> SQL 生成 + 洞察推荐 |
| Query Engine | `lib/query-engine.ts` | 连接池管理 + SQL 执行 |
| Schema Service | `lib/schema-service.ts` | 数据库结构扫描 + AI 上下文构建 |
| SQL Validator | `lib/sql-validator.ts` | SQL 安全校验 (白名单) |
| Variable Types | `lib/variable-types.ts` | 图表类型定义 + 映射槽位 |
| Encryption | `lib/encryption.ts` | AES-256 密码加密/解密 |
| Prisma Client | `lib/prisma.ts` | Prisma 单例客户端 |
| Chart System | `components/charts/` | 8 种图表视图 + 工具函数 |
| Chart Config | `components/chart-config-panel.tsx` | 图表类型选择 + 列映射面板 |
| Insight Card | `components/insight-card.tsx` | AI 洞察卡片组件 |
| Result Panel | `components/dashboard/result-panel.tsx` | 查询结果展示 |
| Toast | `components/toast.tsx` | 操作反馈通知 |
| Layout | `components/layout/` | 侧边栏 + 连接上下文 |
| Shared Types | `types/index.ts` | TypeScript 类型定义 |

---

## 二、核心库

### AI Service (`lib/ai-service.ts`)

调用 OpenAI 兼容 API，将自然语言转换为 SQL 或洞察推荐。

- 自动检测洞察请求 (关键词匹配)
- 普通请求: 输出说明文字 + SQL
- 洞察请求: 输出结构化 JSON (title/insight/sql/chart)
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

图表类型定义和映射槽位。

- 图表类型: line, bar, pie, scatter, boxplot, heatmap, correlation, table
- 映射槽位: 每种图表声明需要的列 (required/optional)
- 自动填充: 根据列名关键字匹配，不做智能推断

### Encryption (`lib/encryption.ts`)

AES-256-GCM 加密/解密数据库连接密码。

---

## 三、组件

### Chart System (`components/charts/`)

8 种图表类型，模块化设计。图表只负责接收数据并绘制，不做复杂推断。

| 类型 | 组件 | 说明 |
| :--- | :--- | :--- |
| line | LineChartView | 折线图 |
| bar | BarChartView | 柱状图 |
| pie | PieChartView | 饼图 (分组聚合) |
| scatter | ScatterChartView | 散点图 |
| boxplot | BoxPlotView | 箱线图 (自绘 SVG) |
| heatmap | HeatmapView | 热力图 (自绘 SVG) |
| correlation | CorrelationHeatmap | 相关系数矩阵 |
| table | TableView | 数据表格 |

### Chart Config Panel (`components/chart-config-panel.tsx`)

图表类型选择 + 列映射面板。

- 图表类型选择器 (SVG 图标，8 种)
- 图例开关 (Eye/EyeOff 图标)
- 映射槽位下拉选择 (自定义 DropdownSelect)
- 必填项提示
- 分组列选择: 唯一值 >20 时弹窗确认
- 图表渲染

### Insight Card (`components/insight-card.tsx`)

AI 洞察卡片组件。

- 显示洞察标题和说明
- 展开查看 SQL 详情
- 执行按钮: 自动运行 SQL + 设置图表类型和列映射
- 支持多条洞察卡片

### Chart Utils (`components/charts/utils.ts`)

固定统计算法和工具函数。

- 计算箱线图统计量 (computeBoxStats)
- Pearson / Spearman / Kendall 相关系数 (联合过滤 NaN，处理并列值)
- 数字格式化 (formatNumber)
- 颜色配置 (getColor)

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

*文档版本: v1.23.0*
*最后更新: 2026-06-26*
