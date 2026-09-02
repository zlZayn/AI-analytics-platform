# AI Analytics Platform

[English](README_en.md) | [简体中文](README.md)

通用型 AI 数据分析平台，支持 PostgreSQL 数据库接入，通过自然语言进行数据分析和可视化。

## 功能

- **连接管理** - PostgreSQL 数据库连接 CRUD，自动测试连接
- **Schema 发现** - 自动扫描数据库结构，缓存 Schema 快照
- **SQL 编辑器** - Monaco Editor，语法高亮，执行 SQL 查询
- **AI 分析** - 自然语言 -> 结构化查询，多轮对话
- **AI 洞察推荐** - 自动生成业务洞察，一键执行并可视化
- **数据探索** - 浏览表结构、字段详情、表关联、数据预览
- **图表可视化** - 表格、KPI、折线、柱状、饼/环、散点、直方、箱线、热力和相关矩阵，用户主动选择列映射
- **查询管理** - 查询历史、保存的查询

## 技术栈

| 层级 | 技术 |
| :--- | :--- |
| 前端 | Next.js 16, React 19, TypeScript, TailwindCSS 4, Base UI |
| 编辑器 | Monaco Editor |
| 可视化 | Recharts + 自绘 SVG (箱线图/热力图/相关矩阵) |
| 后端 | Next.js Route Handlers, Prisma 7, pg |
| 数据库 | PostgreSQL |
| AI | OpenAI Compatible SDK + JSON Schema structured output |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入配置:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_analytics"
ENCRYPTION_KEY=""
AI_API_BASE="https://api.openai.com/v1"
AI_API_KEY="your-api-key"
AI_MODEL="gpt-4o"
```

`ENCRYPTION_KEY` 必须是至少 32 字符的应用专用随机值。生成后填入 `.env`，不要使用示例占位符，也不要在已经保存连接后更换：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

### 3. 初始化数据库

```bash
npx prisma db push
```

### 4. 生成测试数据 (可选)

种子脚本不读取或保存硬编码凭据。显式提供目标数据库连接串：

```powershell
$env:SEED_DATABASE_URL = "postgresql://seed_user:replace-me@localhost:5432/ai_analytics"
python scripts/seed.py
```

脚本只接受 `SEED_DATABASE_URL`，不会回退到应用的 `DATABASE_URL`，避免误向应用或生产数据库写入测试数据。

### 5. 启动开发服务器

```bash
npm run dev
```

访问 <http://localhost:3000>

## 查询安全与边界

查询只允许单条 `SELECT`/`WITH`，在 PostgreSQL 只读事务和 statement timeout 内执行。默认最多返回 5,000 行；结果被截断或图表采样时，界面会明确提示。生产环境应为每个外部数据库配置只读账号。

## 测试与文档

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma generate   # 若 src/generated/prisma 不存在
```

CI（GitHub Actions，见 `.github/workflows/ci.yml`）在每次推送与 PR 上执行同一序列：install → prisma generate → typecheck → lint → test → build → 文档链接校验（`scripts/check-links.py`）→ diff 检查。

AI 合同测试全部使用注入的 fake provider，不调用真实模型 API。浏览器验证见 `docs/testing.md`。
仓库不包含真实 AI 调用脚本或凭据；真实 provider 只用于人工验收，并应使用可轮换的受限密钥。

设计原则、架构决策、API 约定、图表规范和运维说明位于 `docs/`。

## 项目结构

```text
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 连接选择与管理
│   ├── workspace/page.tsx        # 数据工作台 (SQL + AI)
│   ├── explorer/page.tsx         # 数据探索
│   ├── queries/page.tsx          # 查询管理 (收藏 + 历史)
│   └── api/                      # API 路由
│       ├── connections/          # 连接 CRUD
│       ├── schema/               # Schema 扫描
│       ├── query/                # SQL 执行 + 历史 + 保存
│       └── ai/                   # AI 分析 + 洞察推荐
├── components/
│   ├── layout/                   # 布局组件
│   │   ├── app-shell.tsx         # 顶层布局
│   │   ├── sidebar.tsx           # 侧边栏 + 连接选择器
│   │   └── connection-context.tsx # 连接上下文
│   ├── dashboard/                # 共享子组件
│   │   └── result-panel.tsx      # 结果面板
│   ├── workspace/                # 会话状态工作台（重构 v4）
│   │   └── session-workspace.tsx # 会话驱动工作区
│   ├── charts/                   # 图表系统
│   │   ├── views/                # 10 种基础图表视图
│   │   ├── hooks/                # 自定义 hooks
│   │   ├── chart-icons.tsx       # SVG 图标映射
│   │   ├── types.ts              # 图表类型定义
│   │   ├── constants.ts          # 颜色/坐标轴配置
│   │   ├── algorithms.ts         # 固定统计算法
│   │   ├── transform.ts          # 确定性展示变换
│   │   ├── empty-state.tsx       # 空状态组件
│   │   └── error-boundary.tsx    # 图表错误边界
│   ├── SessionView.tsx           # 会话渲染（loading/error/图表 + 警告）
│   ├── chart-config-panel.tsx    # 图表配置面板
│   ├── chart.tsx                 # 图表 re-export
│   ├── insight-card.tsx          # AI 洞察卡片
│   ├── toast.tsx                 # Toast 通知
│   └── ui/                       # 基础 UI 组件 (Base UI + TailwindCSS)
├── hooks/                        # 会话状态（重构 v4）
│   ├── useSession.ts             # Session 管理 + 副作用
│   └── sessionReducer.ts         # 19 种 Action 纯函数转换
├── lib/                          # 核心库
│   ├── ai-service.ts             # AI 服务 (生成分析 + 洞察推荐)
│   ├── ai-contract.ts            # 提示词、JSON Schema 与运行时校验
│   ├── query-compiler.ts         # QuerySpec -> 参数化 SQL（重构 v4）
│   ├── validators.ts             # 双模式校验（重构 v4）
│   ├── render-binder.ts          # 数据绑定到图表（重构 v4）
│   ├── query-engine.ts           # 查询引擎
│   ├── schema-service.ts         # Schema 扫描 + 数据轮廓
│   ├── sql-validator.ts          # SQL 安全校验
│   ├── encryption.ts             # 密码加密
│   ├── prisma.ts                 # Prisma 客户端
│   └── utils.ts                  # 工具函数
├── types/                        # 共享类型 + 会话类型（session.ts/actions.ts）
└── generated/prisma/             # Prisma 客户端 (可再生)

prisma/
└── schema.prisma                 # 数据库 Schema 定义

scripts/
├── seed.py                       # 测试数据生成脚本
├── check-links.py                # 文档链接校验
├── final_ui_smoke.py             # 四视口 UI 烟测
└── offline_workspace_e2e.py      # 离线工作台 E2E

.github/
└── workflows/ci.yml              # GitHub Actions CI
```

## 页面路由

| 路由 | 功能 |
| :--- | :--- |
| `/` | 连接选择与管理 (侧边栏下拉切换) |
| `/workspace?connection=xxx` | 数据工作台 (SQL 编辑 + AI 助手)；加 `&session=1` 启用会话状态版 |
| `/explorer?connection=xxx` | 数据探索 (Schema 浏览) |
| `/queries?connection=xxx` | 查询管理 (收藏 + 历史) |

## API 路由

| 方法 | 路由 | 功能 |
| :--- | :--- | :--- |
| GET/POST | `/api/connections` | 连接列表/创建 |
| GET/PUT/DELETE | `/api/connections/[id]` | 连接详情/更新/删除 |
| GET | `/api/schema/[connectionId]` | Schema 扫描/缓存 |
| POST | `/api/query` | 执行 SQL |
| POST | `/api/query/preview` | 安全表预览（schema/table 标识符） |
| GET | `/api/query/history` | 查询历史 |
| GET/POST | `/api/query/saved` | 保存的查询 |
| POST | `/api/ai` | AI 分析 (结构化 JSON 输出) |
| POST | `/api/ai/insights` | AI 洞察推荐 |

## 图表类型

| 类型 | 说明 |
| :--- | :--- |
| 折线图 | 趋势分析 |
| 柱状图 | 分类对比 |
| 饼图 | 占比分析 |
| 散点图 | 相关性分析 |
| 箱线图 | 统计分布 |
| 热力图 | 矩阵分析 |
| 相关系数矩阵 | 变量相关性 |
| 数据表格 | 原始数据 |
| KPI 指标卡 | 单值与可选对比 |
| 直方图 | 连续变量分布 |

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [AI 集成](docs/04_ai_integration.md)
- [API 约定](docs/api.md)
- [图表规范](docs/charts.md)
- [测试说明](docs/testing.md)
- [运维说明](docs/operations.md)
- [设计哲学](docs/design-philosophy.md)
- [人工验收](docs/manual-acceptance.md)
- 维护者索引与规则：[AGENTS.md](AGENTS.md)