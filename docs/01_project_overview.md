# 项目概述

## 一、项目定位

### 项目名称

AI Analytics Platform

### 项目目标

构建一个支持 PostgreSQL 数据库接入的智能分析平台。用户无需编写 SQL，通过自然语言即可完成数据探索、趋势分析、指标统计和图表生成。

### 核心特性

1. **Schema 深度绑定** - 自动发现数据库结构，理解表关系
2. **AI 驱动分析** - 自然语言输入，智能生成 SQL 和图表
3. **AI 洞察推荐** - 自动生成业务洞察，一键执行并可视化
4. **安全可控** - 所有 SQL 经过白名单校验，只允许 SELECT 查询
5. **可视化丰富** - 10 种基础图表视图，用户主动选择并控制列映射
6. **通用性强** - 可接入任意 PostgreSQL 数据库

---

## 二、技术栈

| 层级 | 技术 | 版本 |
| :--- | :--- | :--- |
| 前端框架 | Next.js (App Router) | 16.2.9 |
| UI 库 | React | 19.2.4 |
| 类型安全 | TypeScript | 5+ |
| 样式 | TailwindCSS | 4+ |
| 组件库 | Base UI | 1.6.0 |
| SQL 编辑器 | Monaco Editor | 4.7.0 |
| 图表 | Recharts + 自绘 SVG | 3.8.1 |
| ORM | Prisma | 7.8.0 |
| PG 客户端 | pg | 8.22.0 |
| AI | OpenAI Compatible SDK | 6.44.0 |

---

## 三、架构设计

### 架构原则

1. **简洁优先** - AI 直接生成 SQL，系统负责安全校验和执行
2. **元数据与业务数据分离** - 平台表 (Prisma) 和用户业务表分开
3. **安全第一** - 所有 SQL 白名单校验，禁止危险操作

### 核心流程

```text
用户输入 -> AI 生成 SQL -> 安全校验 -> 执行查询 -> 用户选择图表类型 + 列映射 -> 可视化
```

### 系统架构

浏览器 (React / Next.js) 通过 HTTP 请求 Next.js App Router。App Router 包含页面、API 路由和布局组件。底层有三个核心服务：Prisma Client 连接平台数据库，AI Service 调用 OpenAI 兼容 API 生成 SQL，Query Engine 执行用户数据库查询。

---

## 四、模块职责

| 模块 | 文件 | 职责 |
| :--- | :--- | :--- |
| AI Service | `lib/ai-service.ts` | 自然语言 -> SQL 生成 + 洞察推荐 |
| Query Engine | `lib/query-engine.ts` | 连接池管理 + SQL 执行 |
| Schema Service | `lib/schema-service.ts` | 数据库结构扫描 + AI 上下文构建 |
| SQL Validator | `lib/sql-validator.ts` | SQL 安全校验 (白名单) |
| Variable Types | `lib/variable-types.ts` | 图表类型定义 + 映射槽位 |
| Encryption | `lib/encryption.ts` | AES-256 密码加密/解密 |
| Chart System | `components/charts/` | 10 种图表视图 + 纯算法/变换管线 |
| Chart Config | `components/chart-config-panel.tsx` | 图表类型选择 + 列映射面板 |
| Insight Card | `components/insight-card.tsx` | AI 洞察卡片组件 |
| Result Panel | `components/dashboard/result-panel.tsx` | 查询结果展示 |
| Toast | `components/toast.tsx` | 操作反馈通知 |
| Layout | `components/layout/` | 侧边栏 + 连接上下文 |
| Shared Types | `types/index.ts` | TypeScript 类型定义 |

---

## 五、目标用户

1. **数据分析师** - 快速探索数据，生成报表
2. **产品经理** - 自助分析业务指标
3. **开发者** - 快速了解数据库结构

---

## 六、成功指标

| 指标 | 目标 |
| :--- | :--- |
| AI SQL 准确率 | > 80% |
| 查询响应时间 | < 3 秒 |
| 用户学习成本 | < 5 分钟 |

---

*文档版本: v1.24.0*
*最后更新: 2026-07-25*
