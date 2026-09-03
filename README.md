# AI Analytics Platform

[English](README_en.md) | 简体中文

面向业务分析的自然语言数据分析平台：接上 PostgreSQL，用对话提问，得到图表和洞察。

## 解决什么问题

- 不会 SQL 也能分析数据——用自然语言提问，AI 生成并执行结构化查询
- 不用写代码连数据库——连接管理、Schema 发现、数据预览一条龙
- 分析结果直接可视化——10 种图表，支持人工调整列映射
- 数据安全有边界——只读事务、参数化查询、白名单校验

设计哲学与边界见 [design-philosophy.md](docs/design-philosophy.md)。

## 功能

- **自然语言分析** - 提问 → AI 生成查询 → 自动执行 → 图表，多轮对话带上下文
- **AI 洞察推荐** - 自动识别业务洞察，一键执行并可视化
- **连接管理** - PostgreSQL 连接 CRUD，自动测试连接，密码 AES 加密存储
- **Schema 发现** - 自动扫描库表结构，缓存快照，预览表数据
- **数据探索** - 浏览表结构、字段详情、表关联、数据预览
- **结果导出** - 一键导出 CSV（Excel 中文兼容）/ JSON，复制 R 代码模板（dplyr + ggplot2）
- **SQL 编辑器** - Monaco Editor 高亮编辑，直接执行查询
- **图表可视化** - 表格、KPI、折线、柱状、饼/环、散点、直方、箱线、热力、相关矩阵，用户主动选择列映射
- **查询管理** - 查询历史与收藏，随时回放

## AI 能看见什么

AI 只基于当前连接的**表结构**与**数据轮廓**回答，看不见原始数据行，也接触不到任何敏感信息：

- 看得见：表名、字段名、数据库类型、每列唯一值数 / NULL 数 / 最小值 / 最大值 / 样本值（最多 6 张表）、本次会话问答历史
- 看不见：查询结果里的数据行（只在你看图表时返回）、连接密码、连接串、平台账号

工作台 AI 助手面板顶部有「AI 可见范围」提示，可点击展开详情。

## 用 @ 指定分析表

输入 `@` 弹出表选择（键盘 ↑↓/Enter 或鼠标点选），选中的表会作为显式上下文注入 AI（只扫描这些表的数据轮廓，不受自动上限约束）。未使用 @ 时自动扫描前 6 张表。图表类型与映射契约始终内置。示例：

- `对比 @orders 与 @customers 的月销售趋势` —— 只分析这两张表
- `分析 @sales_2026` —— 指定单表

## 快速上手（Windows）

1. 双击 **`Start Dev.cmd`** ——依赖、环境变量、数据库客户端自动检查，构建产物最新则直接启动，打开浏览器
2. 打开 <http://localhost:3000>，添加一个 PostgreSQL 连接
3. 进入数据工作台，输入问题，例如"按月统计销售额趋势"

命令行方式见下文；构建用 **`Build.cmd`**（类型检查 + 生产构建，带新鲜度检查）。

### 手动安装

```bash
npm install
# 复制 .env.example 为 .env（Windows: copy .env.example .env），填 DATABASE_URL、ENCRYPTION_KEY
npx prisma db push      # 初始化元数据库
npm run dev             # http://localhost:3000
```

`ENCRYPTION_KEY` 生成：`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`。
可选测试数据：`scripts/seed.py`（只接受 `SEED_DATABASE_URL`，见 [scripts/README.md](scripts/README.md)）。

## 技术栈

| 层级 | 技术 |
| :--- | :--- |
| 前端 | Next.js 16, React 19, TypeScript, TailwindCSS 4, Base UI |
| 编辑/可视化 | Monaco Editor, Recharts + 自绘 SVG |
| 后端 | Next.js Route Handlers, Prisma 7, pg |
| 数据/AI | PostgreSQL, OpenAI Compatible SDK + JSON Schema structured output |

## 安全

查询只允许单条 `SELECT`/`WITH`，在只读事务与 statement timeout 内执行，默认上限 5,000 行。连接密码 AES-256 加密存储（每条随机盐）。生产环境为外部数据库配置只读账号。详见 [api.md](docs/api.md) 与 [operations.md](docs/operations.md)。

## 文档

- 使用/交互：本文件 + [scripts/README.md](scripts/README.md)（启动/构建入口）
- 开发者手册：[src/README.md](src/README.md)（目录职责、页面路由、改动路由）· [prisma/README.md](prisma/README.md)
- 架构与决策：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/design-philosophy.md](docs/design-philosophy.md) · [.agents/notes/](.agents/notes/)（决策记录）
- 接口与规范：[docs/api.md](docs/api.md)（API 合约）· [docs/charts.md](docs/charts.md)（图表规范）· [docs/04_ai_integration.md](docs/04_ai_integration.md)（AI 合同）· [docs/operations.md](docs/operations.md)（运维）
- 测试与验收：[docs/testing.md](docs/testing.md)（含 CI）· [docs/manual-acceptance.md](docs/manual-acceptance.md)（人工验收）
- 维护者索引与规则：[AGENTS.md](AGENTS.md) · 实现状态：[docs/implementation-status.md](docs/implementation-status.md)