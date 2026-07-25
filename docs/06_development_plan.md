# 开发计划

## 一、项目结构

src/app/ 目录包含 Next.js 页面和 API 路由：layout.tsx (根布局)、page.tsx (连接选择与管理)、workspace/page.tsx (数据工作台)、explorer/page.tsx (数据探索)、queries/page.tsx (查询管理)，以及 api/ 下的 connections、schema、query、ai 四组 API 路由。

src/components/ 目录包含所有 UI 组件：layout/ (app-shell、sidebar、connection-context)、dashboard/ (result-panel)、charts/ (图表系统，含 views/hooks/utils 等)、chart-config-panel.tsx、chart.tsx、insight-card.tsx、toast.tsx、ui/ (基础组件)。

src/lib/ 目录包含核心库：ai-service.ts、query-engine.ts、schema-service.ts、sql-validator.ts、variable-types.ts、encryption.ts、prisma.ts、utils.ts。

src/types/ 存放共享类型定义，src/generated/prisma/ 是 Prisma 客户端生成代码。

项目根目录还有 prisma/schema.prisma (数据库 Schema) 和 scripts/seed.py (测试数据生成脚本)。

---

## 二、开发阶段

### Phase 1: 基础搭建 ✓

| 任务 | 状态 |
| :--- | :--- |
| 项目初始化 (Next.js + Prisma + Base UI) | 完成 |
| 数据库连接管理 API | 完成 |
| 连接管理页面 (新建/编辑/删除) | 完成 |
| Schema 自动发现 + 缓存 | 完成 |
| SQL 执行引擎 + 安全校验 | 完成 |
| Monaco SQL 编辑器 | 完成 |
| 查询结果表格 | 完成 |

### Phase 2: 可视化 + AI ✓

| 任务 | 状态 |
| :--- | :--- |
| 图表可视化 (10 种基础视图) | 完成 |
| 图表用户映射 (列选择) | 完成 |
| AI SQL 生成 (OpenAI Compatible) | 完成 |
| AI 多轮对话 UI | 完成 |
| 查询历史 + 保存的查询 | 完成 |

### Phase 3: 体验优化 ✓

| 任务 | 状态 |
| :--- | :--- |
| 侧边栏导航 + 连接上下文 | 完成 |
| 数据探索页面 (表结构/关联/预览) | 完成 |
| 连接编辑功能 | 完成 |
| 代码结构重构 (共享类型、清理依赖) | 完成 |
| 页面职责清晰化 (3 页面: 工作台/探索/管理) | 完成 |
| 跨页面联动 (explorer/queries -> workspace) | 完成 |
| Vercel 风格 UI 统一 | 完成 |
| Toast 通知系统 | 完成 |
| 图表 SVG 图标 | 完成 |
| AI 输出格式优化 (结构化 JSON) | 完成 |
| AI 洞察推荐 | 完成 |
| 连接下拉选择器 | 完成 |
| 交互一致性 (cursor-pointer) | 完成 |

---

## 三、环境配置

### .env

```env
# 数据库
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_analytics"

# AI
AI_API_BASE="https://api.openai.com/v1"
AI_API_KEY="your-api-key"
AI_MODEL="gpt-4o"

# 安全
ENCRYPTION_KEY="your-encryption-key"
```

---

*文档版本: v1.23.0*
*最后更新: 2026-06-26*
