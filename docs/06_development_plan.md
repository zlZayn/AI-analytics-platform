# 开发计划

## 一、项目结构

```text
ai-data-analytics/
├── docs/                           # 文档
│   ├── 01_project_overview.md
│   ├── 02_database_design.md
│   ├── 03_api_design.md
│   ├── 04_ai_integration.md
│   ├── 05_module_design.md
│   ├── 06_development_plan.md
│   └── 07_page_structure.md
│
├── prisma/                         # Prisma 配置
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   │
│   │   ├── (auth)/                 # 认证相关
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   │
│   │   ├── dashboard/              # 主仪表板
│   │   │   ├── layout.tsx          # 侧边栏布局
│   │   │   ├── page.tsx            # 首页/概览
│   │   │   │
│   │   │   ├── connections/        # 连接管理
│   │   │   │   ├── page.tsx        # 连接列表
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # 连接详情
│   │   │   │
│   │   │   ├── ai/                 # AI 分析
│   │   │   │   ├── page.tsx        # AI 对话页面
│   │   │   │   └── [conversationId]/
│   │   │   │       └── page.tsx    # 具体会话
│   │   │   │
│   │   │   ├── explorer/           # 数据探索
│   │   │   │   ├── page.tsx        # Schema 概览
│   │   │   │   └── [tableName]/
│   │   │   │       └── page.tsx    # 表详情
│   │   │   │
│   │   │   ├── editor/             # SQL 编辑器
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── queries/            # 查询管理
│   │   │   │   ├── page.tsx        # 保存的查询
│   │   │   │   └── history/
│   │   │   │       └── page.tsx    # 查询历史
│   │   │   │
│   │   │   └── dashboards/         # 仪表板
│   │   │       ├── page.tsx        # 仪表板列表
│   │   │       └── [id]/
│   │   │           └── page.tsx    # 仪表板详情
│   │   │
│   │   └── shared/                 # 分享页面
│   │       └── [token]/
│   │           └── page.tsx
│   │
│   ├── components/                 # React 组件
│   │   ├── ui/                     # shadcn/ui 组件
│   │   ├── layout/                 # 布局组件
│   │   ├── connection/             # 连接相关组件
│   │   ├── schema/                 # Schema 相关组件
│   │   ├── editor/                 # 编辑器组件
│   │   ├── chart/                  # 图表组件
│   │   ├── dashboard/              # 仪表板组件
│   │   └── ai/                     # AI 相关组件
│   │
│   ├── lib/                        # 工具库
│   │   ├── prisma.ts               # Prisma 客户端
│   │   ├── pg.ts                   # PostgreSQL 连接
│   │   ├── encryption.ts           # 加密工具
│   │   ├── ai.ts                   # AI 客户端
│   │   └── utils.ts                # 通用工具
│   │
│   ├── services/                   # 业务服务
│   │   ├── connection.service.ts
│   │   ├── schema.service.ts
│   │   ├── query.service.ts
│   │   ├── ai.service.ts
│   │   ├── dashboard.service.ts
│   │   └── conversation.service.ts
│   │
│   ├── api/                        # API Routes
│   │   ├── connections/
│   │   ├── schema/
│   │   ├── query/
│   │   ├── ai/
│   │   ├── dashboard/
│   │   └── auth/
│   │
│   ├── stores/                     # Zustand 状态
│   │   ├── connection.store.ts
│   │   ├── schema.store.ts
│   │   ├── query.store.ts
│   │   └── dashboard.store.ts
│   │
│   └── types/                      # TypeScript 类型
│       ├── connection.ts
│       ├── schema.ts
│       ├── query.ts
│       ├── ai.ts
│       └── dashboard.ts
│
├── public/                         # 静态资源
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── .env.local                      # 环境变量
```

---

## 二、开发阶段

### Phase 1: 基础搭建（第 1-2 周）

**目标**：项目初始化 + 连接管理 + Schema 发现 + SQL 编辑器

| 任务 | 工时 | 产出 |
| :--- | :--- | :--- |
| 项目初始化 | 4h | Next.js 项目 + Prisma + shadcn/ui |
| 数据库初始化 | 4h | 平台数据库 Schema |
| 连接管理 API | 6h | CRUD + 测试连接 |
| 连接管理页面 | 6h | 列表 + 创建 + 编辑 |
| Schema 发现 API | 6h | 自动扫描 + 缓存 |
| Schema 浏览页面 | 4h | 表列表 + 字段详情 |
| SQL 执行 API | 6h | 安全校验 + 执行 + 缓存 |
| Monaco Editor 集成 | 4h | SQL 编辑器 |
| 查询结果表格 | 4h | 分页 + 排序 |

**验收标准**：

- 可以添加数据库连接
- 可以查看表结构
- 可以编写和执行 SQL
- 可以查看查询结果

---

### Phase 2: 可视化 + AI（已完成）

**目标**：图表可视化 + AI 分析

| 任务 | 工时 | 产出 |
| :--- | :--- | :--- |
| 基础图表组件 | 8h | 折线/柱状/饼图 |
| 图表推断逻辑 | 4h | 自动推断图表类型 |
| 保存查询功能 | 4h | 保存 + 列表 + 执行 |
| AI 客户端封装 | 4h | OpenAI SDK 集成 |
| Schema Context Builder | 4h | Schema 压缩 |
| AI Service | 6h | 直接生成 SQL |
| AI 对话 API | 4h | 多轮对话支持 |
| AI 对话页面 | 8h | 聊天界面 + 结果展示 |
| 对话历史 | 4h | 保存 + 列表 |

**验收标准**：

- 可以生成基础图表
- 可以用自然语言提问
- AI 能生成正确的 SQL
- 能自动生成图表

**完成日期**：2026-06-22

---

### Phase 3: 仪表板 + 优化（第 5-6 周）

**目标**：仪表板 + 性能优化 + 测试

| 任务 | 工时 | 产出 |
| :--- | :--- | :--- |
| 仪表板 API | 6h | CRUD + 组件管理 |
| 拖拽布局组件 | 8h | React Grid Layout |
| 仪表板页面 | 8h | 创建 + 编辑 + 查看 |
| 组件数据绑定 | 4h | 查询 + 渲染 |
| 分享功能 | 4h | 公开链接 |
| 性能优化 | 6h | 缓存 + 查询优化 |
| 错误处理 | 4h | 异常场景处理 |
| 文档完善 | 4h | API 文档 + 使用说明 |

**验收标准**：

- 可以创建仪表板
- 可以拖拽布局
- 可以分享给他人
- 性能和稳定性达标

---

## 三、技术难点与解决方案

### 1. SQL 安全校验

**难点**：如何准确识别危险操作

**解决方案**：

```typescript
// 1. 使用 SQL Parser 解析 AST
// 2. 遍历 AST 检查节点类型
// 3. 白名单机制

import { Parser } from 'node-sql-parser'

function validateSQL(sql: string): ValidationResult {
  const parser = new Parser()
  
  try {
    const ast = parser.astify(sql)
    
    // 检查是否只有 SELECT 语句
    if (ast.type !== 'select') {
      return { valid: false, error: '只允许 SELECT 查询' }
    }
    
    return { valid: true }
  } catch (error) {
    return { valid: false, error: 'SQL 语法错误' }
  }
}
```

### 2. 大数据量查询

**难点**：如何处理大量数据返回

**解决方案**：

```typescript
// 1. 强制 LIMIT
// 2. 流式返回
// 3. 分页查询

// 流式返回示例
async function* streamQuery(pool: Pool, sql: string) {
  const client = await pool.connect()
  const query = new QueryStream(sql)
  
  const stream = client.query(query)
  
  for await (const row of stream) {
    yield row
  }
  
  client.release()
}
```

### 3. AI 响应不稳定

**难点**：AI 可能返回格式错误的 JSON

**解决方案**：

```typescript
function parseAIResponse(content: string): AnalysisResult {
  try {
    // 尝试直接解析
    return JSON.parse(content)
  } catch {
    // 尝试从文本中提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    // 尝试提取 SQL
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/)
    if (sqlMatch) {
      return {
        analysisType: 'unknown',
        description: 'AI 生成的查询',
        sql: sqlMatch[1],
        chartConfig: { type: 'table', title: '查询结果' },
        insights: [],
        followUp: []
      }
    }
    
    throw new Error('无法解析 AI 响应')
  }
}
```

### 4. Schema 同步

**难点**：用户数据库结构变化后如何同步

**解决方案**：

```typescript
// 1. 定时同步（每天）
// 2. 手动刷新
// 3. 变更检测

async function detectSchemaChanges(
  oldSchema: DatabaseSchema,
  newSchema: DatabaseSchema
): Promise<SchemaDiff> {
  const oldTables = new Set(oldSchema.tables.map(t => t.name))
  const newTables = new Set(newSchema.tables.map(t => t.name))
  
  return {
    added: [...newTables].filter(t => !oldTables.has(t)),
    removed: [...oldTables].filter(t => !newTables.has(t)),
    modified: [] // 需要比较字段变化
  }
}
```

---

## 四、环境配置

### .env.local

```env
# 数据库
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_analytics"

# AI
AI_API_BASE="https://token-plan-cn.xiaomimimo.com/v1"
AI_API_KEY="tp-ce8bn0o4v1mimshlmqdqxuvtrpogqkrdohhmltvequrfy6dx"
AI_MODEL="mimo-v2.5-pro"

# 安全
ENCRYPTION_KEY="your-encryption-key-here"
JWT_SECRET="your-jwt-secret-here"

# 应用
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### package.json

```json
{
  "name": "ai-data-analytics",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:seed": "python scripts/seed.py"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@prisma/client": "^5.0.0",
    "pg": "^8.0.0",
    "openai": "^4.0.0",
    "zustand": "^4.0.0",
    "@tanstack/react-query": "^5.0.0",
    "recharts": "^2.0.0",
    "@monaco-editor/react": "^4.0.0",
    "react-grid-layout": "^1.4.0",
    "node-sql-parser": "^4.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "prisma": "^5.0.0",
    "tailwindcss": "^3.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/pg": "^8.0.0"
  }
}
```

---

## 五、质量保证

### 代码规范

- ESLint + Prettier
- TypeScript 严格模式
- 组件使用 shadcn/ui

### 测试策略

- 单元测试：核心服务逻辑
- 集成测试：API 接口
- E2E 测试：关键流程

### 性能指标

- 页面加载 < 2s
- SQL 执行 < 3s
- AI 响应 < 5s
- 图表渲染 < 1s

---

*文档版本: v1.18.0*
*最后更新: 2026-06-22*
