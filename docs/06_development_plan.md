# 开发计划

## 一、项目结构

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
│   │   ├── index.tsx             # 图表分发器
│   │   ├── types.ts              # 图表类型定义
│   │   ├── constants.ts          # 颜色/坐标轴配置
│   │   ├── utils.ts              # 统计计算工具
│   │   ├── chart-icons.tsx       # SVG 图标映射
│   │   ├── hooks/                # 自定义 hooks
│   │   └── views/                # 9 种图表视图
│   ├── chart-config-panel.tsx    # 图表配置面板
│   ├── chart.tsx                 # 图表 re-export
│   ├── toast.tsx                 # Toast 通知
│   └── ui/                       # shadcn/ui 组件
├── lib/                          # 核心库
│   ├── ai-service.ts             # AI 服务
│   ├── query-engine.ts           # 查询引擎
│   ├── schema-service.ts         # Schema 扫描
│   ├── sql-validator.ts          # SQL 安全校验
│   ├── variable-types.ts         # 变量类型推断
│   ├── encryption.ts             # 密码加密
│   ├── prisma.ts                 # Prisma 客户端
│   └── utils.ts                  # 工具函数
├── types/                        # 共享类型定义
└── generated/prisma/             # Prisma 客户端
```

---

## 二、开发阶段

### Phase 1: 基础搭建 -- 已完成

| 任务 | 状态 |
| :--- | :--- |
| 项目初始化 (Next.js + Prisma + shadcn/ui) | 完成 |
| 数据库连接管理 API | 完成 |
| 连接管理页面 (新建/编辑/删除) | 完成 |
| Schema 自动发现 + 缓存 | 完成 |
| SQL 执行引擎 + 安全校验 | 完成 |
| Monaco SQL 编辑器 | 完成 |
| 查询结果表格 | 完成 |

### Phase 2: 可视化 + AI -- 已完成

| 任务 | 状态 |
| :--- | :--- |
| 图表可视化 (9 种类型) | 完成 |
| 图表自动推断 + ggplot2 映射 | 完成 |
| AI SQL 生成 (OpenAI Compatible) | 完成 |
| AI 多轮对话 UI | 完成 |
| 查询历史 + 保存的查询 | 完成 |

### Phase 3: 体验优化 -- 已完成

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
| AI 输出格式优化 (避免重复 SQL) | 完成 |

---

## 三、未实现 (低优先级)

| 功能 | 说明 | 优先级 |
| :--- | :--- | :--- |
| 认证系统 | 单用户工具，不需要 | 低 |
| 拖拽仪表板 | ROI 太低，SQL + 图表够用 | 低 |
| Service 层拆分 | 小项目不需要 | 低 |
| Zustand 状态管理 | useState 够用 | 低 |

---

## 四、环境配置

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

*文档版本: v1.20.0*
*最后更新: 2026-06-25*
