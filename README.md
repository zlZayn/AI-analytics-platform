# AI Data Analytics Platform

通用型 AI 数据分析平台，支持 PostgreSQL 数据库接入，通过自然语言进行数据分析和可视化。

## 功能

- 数据库连接管理
- Schema 自动发现 (排除平台元数据表)
- SQL 编辑器 (Monaco Editor)
- AI 生成 SQL (自然语言 -> SQL，星型模型上下文)
- 图表可视化 (Recharts)
  - 折线图、柱状图、饼图、散点图
  - 直方图 (Freedman-Diaconis 分箱)
  - 箱线图 (SVG，响应式)
  - 热力图、相关系数矩阵 (Pearson/Spearman/Kendall)
- ggplot2 风格变量映射 (连续变量唯一值少时可当分类用)
- 变量描述性统计预览
- 查询历史、保存查询

## 技术栈

| 层级 | 技术 |
| :--- | :--- |
| 前端 | Next.js 14, React 18, TypeScript, TailwindCSS, shadcn/ui |
| 编辑器 | Monaco Editor |
| 可视化 | Recharts + 自绘 SVG (箱线图/热力图/相关矩阵) |
| 后端 | Next.js Route Handlers, Prisma 7, pg |
| 数据库 | PostgreSQL (星型模型) |
| AI | OpenAI Compatible SDK (MiMo) |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```env
DATABASE_URL="postgresql://postgres:Lzy20050914@localhost:5432/ai_analytics"
AI_API_BASE="https://token-plan-cn.xiaomimimo.com/v1"
AI_API_KEY="your-api-key"
AI_MODEL="mimo-v2.5-pro"
```

### 3. 初始化数据库

```bash
npx prisma db push
```

### 4. 生成测试数据

```bash
python scripts/seed.py
```

测试数据为药店会员系统，星型模型:

| 维度表 | 说明 |
| :--- | :--- |
| dim_date | 日期 (年/季/月/周/节假日) |
| dim_member | 会员 (800人，含等级/细分/活跃状态) |
| dim_product | 商品 (64种，8大类，含品牌/规格/剂型) |
| dim_pharmacy | 门店 (10家，东莞各区) |
| dim_promotion | 促销 (5种) |
| dim_payment | 支付方式 (4种) |

| 事实表 | 说明 | 行数 |
| :--- | :--- | :--- |
| fact_orders | 订单行级 (每件商品一行) | ~9400 |
| fact_behavior | 用户行为 (浏览/收藏/加购/购买) | 10000 |
| fact_inventory | 库存变动 | 800 |
| fact_refunds | 退款记录 | ~750 |

### 5. 启动开发服务器

```bash
npm run dev
```

访问 <http://localhost:3000>

## 项目结构

```text
ai-data-analytics/
├── docs/                          # 项目文档
├── prisma/                        # Prisma Schema (平台元数据)
├── scripts/
│   └── seed.py                    # 测试数据生成 (星型模型)
├── src/
│   ├── app/
│   │   ├── api/                   # API 路由
│   │   │   ├── ai/                # AI SQL 生成
│   │   │   ├── connections/       # 数据库连接 CRUD
│   │   │   ├── query/             # SQL 执行
│   │   │   └── schema/            # Schema 扫描
│   │   └── dashboard/             # Dashboard 页面
│   ├── components/
│   │   ├── chart.tsx              # Chart re-export
│   │   ├── chart-config-panel.tsx # 图表配置面板 (变量选择/统计预览)
│   │   ├── charts/                # 图表模块化组件
│   │   │   ├── index.tsx          # 主分发 + ErrorBoundary
│   │   │   ├── types.ts           # ChartType, ChartMapping
│   │   │   ├── constants.ts       # COLORS, AXIS_CONFIG
│   │   │   ├── utils.ts           # formatNumber, computeBins, computeBoxStats
│   │   │   ├── hooks/             # useGroupedData, useContainerWidth
│   │   │   └── views/             # 9 个图表视图组件
│   │   └── ui/                    # shadcn/ui 组件
│   └── lib/
│       ├── prisma.ts              # Prisma 客户端
│       ├── ai-service.ts          # AI 服务 (星型模型提示词)
│       ├── query-engine.ts        # 查询引擎
│       ├── schema-service.ts      # Schema 服务 (过滤平台表)
│       ├── variable-types.ts      # 变量类型推断 + ggplot2 映射
│       └── sql-validator.ts       # SQL 安全校验
└── .env                           # 环境配置
```

## 数据库连接

演示数据库:

- 主机: localhost
- 端口: 5432
- 数据库: ai_analytics
- 用户名: postgres
- 密码: Lzy20050914

## 文档

- [项目概述](docs/01_project_overview.md)
- [数据库设计](docs/02_database_design.md) -- 包含星型模型 Schema
- [API 设计](docs/03_api_design.md)
- [AI 集成](docs/04_ai_integration.md)
- [模块设计](docs/05_module_design.md)
- [开发计划](docs/06_development_plan.md)
- [页面结构](docs/07_page_structure.md)
- [变更日志](docs/CHANGELOG.md) -- 所有版本变更记录
