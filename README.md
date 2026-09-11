# AI Analytics Platform

[![CI](https://github.com/zlZayn/AI-analytics-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/zlZayn/AI-analytics-platform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-22-brightgreen)](.node-version)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

[English](README_en.md) | 简体中文

接上 PostgreSQL，用自然语言提问，得到图表与洞察——浏览器里完成分析全程，数据不出库。

## 能力一览

- **对话式分析** — 提问 → AI 生成结构化查询 → 自动执行出图；多轮对话带上下文，洞察卡片一键执行
- **SQL 工作台** — Monaco 高亮编辑直接执行；查询收藏 + 统一历史时间线（SQL / AI / R 三类混排，一键回放）
- **图表可视化** — 表格、KPI、折线、柱状、饼/环、散点、直方、箱线、热力、相关矩阵，列映射人工可调
- **浏览器内 R** — WebR 工作台：查询结果注入为 `df`，写 dplyr / ggplot2 代码即可出图，无需本地 R 环境
- **数据接入** — PostgreSQL 连接 CRUD 与测试、密码 AES-256 加密存储；Schema 自动发现、快照缓存、表数据预览
- **结果带走** — 一键导出 CSV（Excel 中文兼容）/ JSON，复制 R 代码模板
- **安全边界** — 只读事务、单条 `SELECT`/`WITH` 白名单校验、参数化查询、默认 5,000 行上限

## AI 能看见什么

AI 只基于当前连接的**表结构**、**数据轮廓**与**图表契约**回答，看不见原始数据行：

- 看得见：表名、字段名、数据库类型、每列唯一值数 / NULL 数 / 最小值 / 最大值 / 样本值（默认 6 张表）；10 种图表类型及槽位规则；本次会话问答历史
- 看不见：查询结果的数据行（只在你看图表时返回）、连接密码、连接串、平台账号

工作台 AI 助手面板顶部有「AI 可见范围」提示，可展开核对。

## 用 @ 指定分析表

输入 `@` 弹出表选择器，选中的表作为显式上下文注入 AI（只扫描这些表，不受自动上限约束）；未使用 @ 时自动扫描前 6 张表。

```
对比 @orders 与 @customers 的月销售趋势
分析 @sales_2026
```

## 快速上手

**Windows**：双击 `Start Dev.cmd`——依赖、环境变量、数据库客户端自动检查，构建产物最新则直接启动并打开浏览器，访问 <http://localhost:3000>。构建用 `Build.cmd`（类型检查 + 生产构建，带新鲜度检查）。

**通用**：

```bash
npm ci                      # 可复现安装（Node 版本见 .node-version，当前基线 22）
# 复制 .env.example 为 .env，填 DATABASE_URL 与 ENCRYPTION_KEY
npx prisma migrate deploy   # 初始化元数据库（勿用 db push，会 DROP 业务表）
npm run dev                 # http://localhost:3000
```

`ENCRYPTION_KEY` 生成：`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`。
可选测试数据：`python scripts/seed.py`（只接受 `SEED_DATABASE_URL`）。启动与构建脚本用法见 [scripts/README.md](scripts/README.md)。
添加一个 PostgreSQL 连接 → 进入工作台提问，例如"按月统计销售额趋势"。

## 技术栈

| 层级 | 技术 |
| :--- | :--- |
| 前端 | Next.js 16, React 19, TypeScript, TailwindCSS 4, Base UI |
| 编辑/可视化 | Monaco Editor（本地托管）, Recharts + 自绘 SVG |
| 后端 | Next.js Route Handlers, Prisma 7, pg |
| 数据/AI | PostgreSQL, OpenAI Compatible SDK + JSON Schema structured output |

## 安全

查询只允许单条 `SELECT`/`WITH`，在只读事务与 statement timeout 内执行，默认上限 5,000 行；连接密码 AES-256 加密存储（每条随机盐）。生产环境请为外部数据库配置只读账号。详见 [docs/operations.md](docs/operations.md)。

## 文档

- 设计哲学与边界：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 接口 / AI 合同 / 运行参数：[docs/api.md](docs/api.md) · [docs/ai-integration.md](docs/ai-integration.md) · [docs/operations.md](docs/operations.md)
- 验证与人工验收：[docs/verification.md](docs/verification.md)
- 开发者手册（目录职责、页面路由、改动路由）：[src/README.md](src/README.md)
- 维护者文档地图（完整索引）：[AGENTS.md](AGENTS.md)

## 贡献

改动后跑 `npm test`、`npm run typecheck`、`npm run lint`；涉及 app 路由时同步 `scripts/` 下的浏览器脚本 mock。提交规范与文档同步约定见 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)
