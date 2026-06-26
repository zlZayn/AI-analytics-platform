# AI Data Analytics Platform

通用型 AI 数据分析平台，支持 PostgreSQL 数据库接入，通过自然语言进行数据分析和可视化。

## 功能

- **连接管理** - PostgreSQL 数据库连接 CRUD，自动测试连接
- **Schema 发现** - 自动扫描数据库结构，缓存 Schema 快照
- **SQL 编辑器** - Monaco Editor，语法高亮，执行 SQL 查询
- **AI 分析** - 自然语言 -> SQL，多轮对话
- **数据探索** - 浏览表结构、字段详情、表关联、数据预览
- **图表可视化** - 8 种图表类型，用户自由选择列映射
- **查询管理** - 查询历史、保存的查询

## 技术栈

| 层级 | 技术 |
| :--- | :--- |
| 前端 | Next.js 16, React 19, TypeScript, TailwindCSS 4, shadcn/ui |
| 编辑器 | Monaco Editor |
| 可视化 | Recharts + 自绘 SVG (箱线图/热力图/相关矩阵) |
| 后端 | Next.js Route Handlers, Prisma 7, pg |
| 数据库 | PostgreSQL |
| AI | OpenAI Compatible SDK (MiMo) |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入配置:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_analytics"
AI_API_BASE="https://api.openai.com/v1"
AI_API_KEY="your-api-key"
AI_MODEL="gpt-4o"
```

### 3. 初始化数据库

```bash
npx prisma db push
```

### 4. 生成测试数据 (可选)

```bash
python scripts/seed.py
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 <http://localhost:3000>

## 项目结构

```text
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 连接管理页
│   ├── workspace/page.tsx        # 数据工作台 (SQL + AI)
│   ├── explorer/page.tsx         # 数据探索
│   ├── queries/page.tsx          # 查询管理 (收藏 + 历史)
│   └── api/                      # API 路由
│       ├── connections/          # 连接 CRUD
│       ├── schema/               # Schema 扫描
│       ├── query/                # SQL 执行 + 历史 + 保存
│       └── ai/                   # AI SQL 生成
├── components/
│   ├── layout/                   # 布局组件
│   │   ├── app-shell.tsx         # 顶层布局
│   │   ├── sidebar.tsx           # 侧边栏导航
│   │   └── connection-context.tsx # 连接上下文
│   ├── dashboard/                # 共享子组件
│   │   └── result-panel.tsx      # 结果面板
│   ├── charts/                   # 图表系统
│   │   ├── views/                # 8 种图表视图
│   │   ├── hooks/                # 自定义 hooks
│   │   ├── chart-icons.tsx       # SVG 图标映射
│   │   ├── types.ts              # 图表类型定义
│   │   ├── constants.ts          # 颜色/坐标轴配置
│   │   └── utils.ts              # 统计计算工具
│   ├── chart-config-panel.tsx    # 图表配置面板
│   ├── chart.tsx                 # 图表 re-export
│   ├── toast.tsx                 # Toast 通知
│   └── ui/                       # shadcn/ui 组件
├── lib/                          # 核心库
│   ├── ai-service.ts             # AI 服务
│   ├── query-engine.ts           # 查询引擎
│   ├── schema-service.ts         # Schema 扫描
│   ├── sql-validator.ts          # SQL 安全校验
│   ├── variable-types.ts         # 图表类型定义 + 映射槽位
│   ├── encryption.ts             # 密码加密
│   ├── prisma.ts                 # Prisma 客户端
│   └── utils.ts                  # 工具函数
├── types/                        # 共享类型定义
└── generated/prisma/             # Prisma 客户端
```

## 页面路由

| 路由 | 功能 |
| :--- | :--- |
| `/` | 连接管理 (新建/编辑/删除) |
| `/workspace?connection=xxx` | 数据工作台 (SQL 编辑 + AI 助手) |
| `/explorer?connection=xxx` | 数据探索 (Schema 浏览) |
| `/queries?connection=xxx` | 查询管理 (收藏 + 历史) |

## API 路由

| 方法 | 路由 | 功能 |
| :--- | :--- | :--- |
| GET/POST | `/api/connections` | 连接列表/创建 |
| GET/PUT/DELETE | `/api/connections/[id]` | 连接详情/更新/删除 |
| GET | `/api/schema/[connectionId]` | Schema 扫描/缓存 |
| POST | `/api/query` | 执行 SQL |
| GET | `/api/query/history` | 查询历史 |
| GET/POST | `/api/query/saved` | 保存的查询 |
| POST | `/api/ai` | AI SQL 生成 |

## 图表类型

| 类型 | 说明 |
| :--- | :--- |
| 折线图 | 趋势分析 |
| 柱状图 | 分类对比 |
| 饼图 | 占比分析 |
| 散点图 | 相关性分析 |
| 直方图 | 分布分析 |
| 箱线图 | 统计分布 |
| 热力图 | 矩阵分析 |
| 相关系数矩阵 | 变量相关性 |
| 数据表格 | 原始数据 |

## 文档

- [项目概述](docs/01_project_overview.md)
- [数据库设计](docs/02_database_design.md)
- [API 设计](docs/03_api_design.md)
- [AI 集成](docs/04_ai_integration.md)
- [模块设计](docs/05_module_design.md)
- [开发计划](docs/06_development_plan.md)
- [页面结构](docs/07_page_structure.md)
- [变更日志](docs/CHANGELOG.md)
