# AI 分析平台重构 — 完整 Handoff

> **用途**：将此文档完整复制给下一个 AI Agent，继续推进重构任务。
> **生成时间**：2026-09-02
> **生成环境**：当前沙箱工作区 `/workspace`（git clone 自 GitHub，refactor-plan 分支）
> **当前阶段**：阶段一（建立新层）— 方案已推送；**阶段一代码不在本工作区**，npm install 未完成

---

## 一、项目背景

### 1.1 项目信息（已核对）

| 项目 | 内容 |
|------|------|
| GitHub 仓库 | `zlZayn/AI-analytics-platform` |
| 仓库地址 | https://github.com/zlZayn/AI-analytics-platform |
| 工作分支 | `refactor-plan`（**不合并到 main，持续更新**） |
| 主分支 | `main` |
| 技术栈 | Next.js 16.2.9 + React 19.2.4 + TypeScript 5 + PostgreSQL + Prisma 7 + OpenAI API + Recharts 3 |
| 项目版本 | 1.24.0 |

### 1.2 用户信息

| 项目 | 内容 |
|------|------|
| 身份 | 天津中医药大学（双一流）应用统计学大四学生 |
| 技能栈 | R + Python + TypeScript |
| 目标方向 | 商业分析 + AI Agent/Harness 工程化 |
| 偏好 | 讨厌 SAS 和复杂组学；AI 协作能力非常熟练；要求代码直接可运行，不画饼 |

### 1.3 项目简介

一个让非技术用户通过自然语言对话，对数据库执行探索性数据分析的 Web 工具。AI 负责理解意图并生成查询，平台负责安全执行、结果可视化、交互调整。

---

## 二、重构计划（完整四阶段）

> 完整方案文档已推送到 GitHub：`docs/REFACTOR_PLAN_v4.md`（refactor-plan 分支，提交 `70e8758`）
> 进度追踪文件：`REFACTOR_STATUS.md`（refactor-plan 分支）

### 核心矛盾

当前代码用"事件处理"方式：用户点按钮 → 改多个独立 state → state 各自触发渲染 → state 之间隐式依赖、相互覆盖。

### 解决方向

改用"状态描述"方式：用户任何操作 → 修改唯一状态对象（AnalysisSession）→ 系统根据状态计算出应该显示什么。

**一句话**：状态是唯一的真相，视图是状态的函数，操作是状态的转换。

### 阶段一：建立新层（当前阶段）

| 任务 | 文件 | 状态（本工作区实测） |
|------|------|------|
| 定义类型 | `src/types/session.ts` | ⚠️ 不在本工作区，待创建/恢复 |
| 定义 Action | `src/types/actions.ts` | ⚠️ 不在本工作区，待创建/恢复 |
| 实现编译器 | `src/lib/query-compiler.ts` | ⚠️ 不在本工作区，待创建/恢复 |
| 实现校验器 | `src/lib/validators.ts` | ⚠️ 不在本工作区，待创建/恢复 |
| 扩展 Schema | `src/lib/schema-service.ts` | ⚠️ 本工作区为未修改原版，待追加数据轮廓扫描 |
| npm install | `node_modules/` | ❌ 未完成（node_modules 不存在，无进程在跑） |
| TypeScript 编译验证 | `npm run typecheck` | ⏳ 阻塞（依赖 npm install） |
| 推送到 refactor-plan 分支 | git push | ⏳ 待执行 |
| 更新 REFACTOR_STATUS.md | 勾选阶段一任务 | ⏳ 待执行 |

**验收标准**：
- 所有新文件 TypeScript 编译通过
- query-compiler 支持 dimensions/measures/filters/having/sort/limit/joins/Expression，参数化查询防注入
- validators 双模式（schema-based / data-based），字段存在 + 类型匹配 + 重复坐标 + 无效数值 + 高基数
- schema-service 数据轮廓扫描：唯一值数、NULL 率、样本值、min/max
- 旧代码未修改（schema-service.ts 是追加，不破坏现有函数）

### 阶段二：接入状态

| 任务 | 文件 | 状态 |
|------|------|------|
| 实现 useSession | `src/hooks/useSession.ts` | ⬜ 待开始 |
| 实现 sessionReducer | `src/hooks/sessionReducer.ts` | ⬜ 待开始 |
| 接入 workspace | `src/app/workspace/page.tsx` | ⬜ 待开始 |
| 修改 API 路由传 history | `src/app/api/ai/route.ts`、`src/app/api/ai/insights/route.ts` | ⬜ 待开始 |

**验收标准**：
- reducer 单元测试通过
- workspace 现有功能完整（提问→AI返回→执行→出图→改映射）
- 多轮对话有上下文
- feature flag 可回退到旧 state 管理

### 阶段三：切换 AI 输出

| 任务 | 文件 | 状态 |
|------|------|------|
| 修改 AI 契约（同时输出 sql + querySpec） | `src/lib/ai-contract.ts` | ⬜ 待开始 |
| 修改 parse 逻辑（优先 querySpec，回退 sql） | `src/lib/ai-contract.ts` | ⬜ 待开始 |
| 修改 ai-service（generateAnalysis + conversationHistory） | `src/lib/ai-service.ts` | ⬜ 待开始 |

**验收标准**：
- AI 同时输出 sql + querySpec + displayConfig
- querySpec 存在时优先使用，编译通过
- querySpec 缺失时回退到 sql，功能正常
- 新旧客户端都能解析响应

### 阶段四：数据流转改造

| 任务 | 文件 | 状态 |
|------|------|------|
| 修改 query-engine 返回 SemanticDataset | `src/lib/query-engine.ts` | ⬜ 待开始 |
| 实现 render-binder | `src/lib/render-binder.ts` | ⬜ 待开始 |
| 修改图表组件展示 warnings | `src/components/charts/views/*.tsx` | ⬜ 待开始 |
| 创建 SessionView 组件 | `src/components/SessionView.tsx` | ⬜ 待开始 |

**验收标准**：
- 查询结果列含 semanticType
- 分类变量放 Y 轴自动 coord_flip 并提示
- 散点图无效行显示警告（含数量）
- 用户改映射后自动判断是否重查
- 柱状图→折线图不重新查询
- InsightCard 显示 error 状态

---

## 三、当前真实进度（本工作区实测，2026-09-02）

### 3.1 已完成并落库到 GitHub 的工作

1. **架构诊断与方案审核（v3.0 → v4.0）**：已并入方案文档
2. **方案文档推送**：提交 `70e8758`，含两个文件
   - `docs/REFACTOR_PLAN_v4.md` — 完整重构方案（十部分）
   - `REFACTOR_STATUS.md` — 进度追踪模板（四阶段任务清单 + 验收标准 + 风险表）
   - 提交信息：`docs: add unified refactor plan v4.0 (AnalysisSession + QuerySpec + semantic type)`
   - **已核验**：本工作区 `git log` 指向 `70e8758`，本地与 `origin/refactor-plan` 一致

### 3.2 重要更正：阶段一代码不在本工作区

上一运行环境（`/home/user/.super_doubao/super-doubao-runtime/workspace/AI-analytics-platform/`）曾声称已完成 5 个文件的实现（session.ts / actions.ts / query-compiler.ts / validators.ts / schema-service.ts 追加），**但该工作从未推送或持久化到 GitHub**。

**本工作区实测结果**：
- `git status`：工作树干净，仅 `.uploads/` 未跟踪；**没有** `M src/lib/schema-service.ts`，**没有** 4 个新增文件
- `src/types/` 目录仅有 `index.ts`
- `src/lib/` 目录无 query-compiler.ts、validators.ts
- 结论：**阶段一代码需要重新实现**，或从原运行环境找回（若仍可访问）

> 第四节、第五节保留了上一环境的设计摘要，可作为重新实现时的规格参考。若无法找回原文件，按该设计重新编写即可，接口与验收标准不变。

### 3.3 进行中的任务（安装状态）

| 任务 | 状态 | 实测说明 |
|------|------|---------|
| npm install | ❌ 未完成 | `/workspace/node_modules` 不存在；`ps` 无 npm/node 进程在跑；之前"被中断"的后台安装进程已不存在 |
| TypeScript 编译验证 | ⏳ 阻塞 | 依赖 npm install 完成；系统全局有 tsc 7.0.2（`npx --no-install tsc`），但项目未装依赖时不能用项目级 tsc |
| 推送到 refactor-plan 分支 | ⏳ 待执行 | 依赖编译验证通过 |
| 更新 REFACTOR_STATUS.md | ⏳ 待执行 | 当前文件里阶段一仍为"⬜ 待开始"，与真实状态一致 |

### 3.4 下一步立即执行的操作（顺序固定）

1. 在 `/workspace` 运行 `npm install --legacy-peer-deps`（或 `npm ci`；已有 package-lock.json v3，首选 `npm ci`，失败再 `npm install --legacy-peer-deps`）
2. 恢复或重新实现阶段一 5 个文件（先尝试原环境，否则按第四节、第五节规格实现）
3. 运行 `npm run typecheck` 验证
4. 修复编译错误（strict 模式已开启，注意 null 检查）
5. 用 GitHub MCP 的 `push_files` 推送到 refactor-plan 分支（一次提交含 5 文件 + 更新后的 REFACTOR_STATUS.md）
6. 更新 REFACTOR_STATUS.md，勾选阶段一任务，添加更新日志
7. 开始阶段二：创建 useSession.ts 和 sessionReducer.ts

---

## 四、核心数据模型设计（阶段一规格，供重新实现）

> 目标文件：`src/types/session.ts`

### 4.1 AnalysisSession（核心状态容器）

```typescript
interface AnalysisSession {
  id: string
  question: string
  title: string
  insight: string
  querySpec: QuerySpec
  compiledSql: CompiledSql | null  // { sql, params } 参数化
  result: SemanticDataset | null
  displayConfig: DisplayConfig
  status: 'idle' | 'compiling' | 'executing' | 'ready' | 'error' | 'needs_recompile'
  error?: string
  source: 'ai' | 'user'
  isUserModified: boolean
  conversationHistory: ConversationMessage[]
  createdAt: Date
  updatedAt: Date
}
```

### 4.2 QuerySpec（查询规范）

支持：table、dimensions（string | Expression）、measures、filters、having、sort（数组）、limit、joins

Expression 支持：date_trunc、extract、concat

### 4.3 SemanticDataset（语义数据集）

扩展现有 QueryResult（`src/types/index.ts`），columns 增加 `semanticType` 字段，补 `executionTimeMs`。

### 4.4 DisplayConfig（呈现配置）

复用现有 ChartType（`src/lib/variable-types.ts`）和 ChartMapping（`src/components/charts/types.ts`），增加 `showLegend` 和 `mode`。

### 4.5 SessionAction（目标文件 `src/types/actions.ts`）

SessionAction 联合类型，共 **19 种 Action**（含 ASK_AI、SET_COMPILED_SQL、CHANGE_CHART_TYPE、INIT_FROM_AI、UPDATE_QUERY_SPEC、UPDATE_DISPLAY_CONFIG、EXECUTE_SUCCESS、EXECUTE_ERROR 等），外加 SessionDispatch。

---

## 五、关键实现细节设计（阶段一规格，供重新实现）

### 5.1 query-compiler.ts 防注入设计

- 所有 filter.value 通过 `params` 数组传递，SQL 中用 `$N` 占位符
- 标识符（表名、列名、别名）用双引号包裹，内部双引号转义为 `""`
- SQL 关键字（如 DATE_TRUNC 的 precision）用单引号包裹，内部单引号转义为 `''`
- limit 用 `Number()` 转换后直接拼接（数字类型无注入风险）
- 导出 `compileQuerySpec(querySpec, schema)` → `{ sql, params }`

### 5.2 validators.ts 双模式设计

- **schema-based**：用 SchemaData（注意：不是"SchemaContext"，此类型在 v3.0 方案中不存在），根据数据库类型推断 semanticType，检查字段存在 + 类型匹配
- **data-based**：用 SemanticDataset，直接读取 semanticType，额外检查重复坐标、无效数值、高基数（>50 唯一值）
- 槽位类型规则从现有 `src/components/charts/pipeline.ts` 的 `validateChartMapping` 迁移，增加 boolean 类型支持
- 重复坐标检查覆盖 line **和 bar**（原代码只检查 line）——DUPLICATE_COORDINATE_TYPES 包含两者
- 导出 `validateDisplayConfig(config, context, mode)` → ValidationResult / ValidationIssue

### 5.3 schema-service.ts 数据轮廓扫描（追加，不破坏现有函数）

- `scanDataProfile(connectionId, tableName)`：扫描单个表，对每个列获取 distinct_count、null_count、min、max、5 个样本值
- `scanAllDataProfiles(connectionId)`：扫描所有用户表（默认最多 10 个）
- `buildDataProfileText(profiles)`：生成 Markdown 表格格式的 Prompt 文本
- 现有函数（scanSchema、buildSchemaContext、getPool）**完全保留**，新功能追加在文件末尾

---

## 六、现有代码关键文件索引

> 这些文件在后续阶段需要修改，提前了解结构。均已核验存在于本工作区。

| 文件 | 职责 | 后续阶段 |
|------|------|---------|
| `src/types/index.ts` | 现有类型：Connection、QueryResult、SchemaData、SchemaColumn 等 | 阶段二（SemanticDataset 引用） |
| `src/lib/variable-types.ts` | ChartType、CorrelationMethod、CHART_TYPE_SLOTS 等 | 阶段三（AI 输出引用） |
| `src/components/charts/types.ts` | ChartMapping 判别联合类型、ChartProps | 阶段二/四（DisplayConfig 引用） |
| `src/components/charts/mapping.ts` | ChartMappingSlot、getMappingSlot、setMappingSlot、createChartMapping | 阶段四（validators 已引用 getMappingSlot） |
| `src/components/charts/pipeline.ts` | profileData、recommendCharts、createMappingForChart、validateChartMapping | 阶段四（validateChartMapping 迁移到 validators，其他保留） |
| `src/lib/ai-contract.ts` | CHART_CONTRACTS、AI_RESPONSE_JSON_SCHEMA、buildSystemPrompt、parseInsightItems、parseChartMapping | 阶段三（核心修改文件） |
| `src/lib/ai-service.ts` | generateSQL（调用 OpenAI） | 阶段三（改为 generateAnalysis） |
| `src/lib/query-engine.ts` | executeQuery（执行 SQL，返回 QueryResult） | 阶段四（改为返回 SemanticDataset） |
| `src/lib/sql-validator.ts` | validateSQL（只读、单条、黑名单检查） | 保持不变 |
| `src/app/workspace/page.tsx` | 工作区主组件，当前管理 5 个独立 state | 阶段二（核心修改文件） |
| `src/components/dashboard/result-panel.tsx` | 结果面板，内部 chartState 不向上回传 | 阶段二（改为受控组件） |
| `src/components/insight-card.tsx` | 洞察卡片，无 error 状态 | 阶段二/四（增加 error 状态） |
| `src/components/chart-config-panel.tsx` | 图表配置面板 | 阶段四（增加 onChartTypeChange） |
| `src/app/api/ai/route.ts` | AI 对话 API 路由 | 阶段二（传递 conversationHistory） |
| `src/app/api/ai/insights/route.ts` | AI 洞察 API 路由 | 阶段二（传递 conversationHistory） |
| `src/lib/client-api.ts` | 前端 API 客户端封装 | 阶段二（可能需要修改） |
| `src/lib/api-response.ts` | API 响应类型 | 保持不变 |

---

## 七、审核发现与修复记录（v3.0 → v4.0）

> 这些结论已体现在 v4.0 方案与阶段设计里，实施时对照执行。

### 7.1 严重问题（v4.0 已修复/有明确处理）

| # | 问题 | v4.0 处理方式 |
|---|------|-------------|
| 1 | SQL 注入：query-compiler 直接拼接 filter.value | ✅ compiledSql 增加 params 字段，全部参数化，$N 占位符 |
| 2 | countInvalid 未定义（render-binder） | ⚠️ render-binder 在阶段四实现，实现时需注意此 bug |
| 3 | 类型不一致：SchemaContext 未定义、defaultTable 不存在、executionTimeMs 缺失 | ✅ SemanticDataset 补了 executionTimeMs；QuerySpec 增加 table? 字段；validators 用 SchemaData 而非 SchemaContext |
| 4 | Action 缺失：ASK_AI、SET_COMPILED_SQL、CHANGE_CHART_TYPE | ✅ actions.ts 定义全部 19 种 Action |
| 5 | 关键变量未传入：useSession 的 connectionId、schema | ⚠️ 阶段二实现 useSession 时需作为参数传入 |
| 6 | Reducer 不是纯函数：引用外部 schema | ⚠️ 阶段二实现 reducer 时需将 schema 作为参数或通过闭包传入 |

### 7.2 中等问题（v4.0 已修复/待处理）

| # | 问题 | 状态 |
|---|------|------|
| 7 | QuerySpec 不支持 JOIN/HAVING/表达式 | ✅ 已支持 joins、having、Expression |
| 8 | 数据轮廓扫描未实现 | ✅ schema-service.ts 追加 scanDataProfile（本工作区待实现） |
| 9 | 多轮对话 history 只存 title | ✅ ConversationMessage 增加 metadata 携带完整结构化数据 |
| 10 | 迁移计划前后矛盾（AI 输出格式） | ✅ 阶段三明确"AI 同时输出 sql + querySpec（过渡期）" |
| 11 | 文件迁移边界模糊 | ✅ 方案 3.3 节明确了每个文件保留什么、删除什么 |
| 12 | Token 消耗对比不准确 | ⚠️ 方案中仍有此说法，实施时不纠结 |
| 13 | 重复坐标检查遗漏 bar | ✅ validators.ts 中 DUPLICATE_COORDINATE_TYPES 包含 line 和 bar |

### 7.3 小问题

| # | 问题 | 状态 |
|---|------|------|
| 14 | Number("") → 0 的对比错误（现有 finiteNumber 已处理） | ⚠️ 方案描述有误，代码实现正确 |
| 15 | coord_flip 直接修改入参 | ⚠️ 阶段四实现 render-binder 时需返回新对象 |
| 16 | useEffect 依赖不完整 | ⚠️ 阶段二实现 useSession 时需注意 |
| 17 | 代码行数估计偏乐观 | 不影响实施 |

---

## 八、GitHub 操作指南

### 8.1 推送文件到 refactor-plan 分支

本环境可用的 GitHub 工具（MCP server：`mcp_trae-remote-official_plugin_github_github`，通过 `run_mcp` 调用，server_name=`mcp_trae-remote-official_plugin_github_github`）：

| 工具 | 用途 |
|------|------|
| `push_files` | 一次提交多个文件（阶段一推荐） |
| `create_or_update_file` | 创建/更新单个文件 |
| `create_branch` | 创建分支 |
| `list_branches` | 列出分支 |
| `get_me` | 获取当前认证用户 |
| `get_file_contents` | 获取文件内容 |

`push_files` 调用示意（阶段一推送时使用，owner 为 `zlZayn`）：

```typescript
// run_mcp args
{
  owner: "zlZayn",
  repo: "AI-analytics-platform",
  branch: "refactor-plan",
  message: "feat: implement phase 1 core types, query compiler, validators, and data profiling",
  files: [
    { path: "src/types/session.ts", content: "<文件完整内容>" },
    { path: "src/types/actions.ts", content: "<文件完整内容>" },
    { path: "src/lib/query-compiler.ts", content: "<文件完整内容>" },
    { path: "src/lib/validators.ts", content: "<文件完整内容>" },
    { path: "src/lib/schema-service.ts", content: "<文件完整内容（含追加部分）>" },
    { path: "REFACTOR_STATUS.md", content: "<更新后的状态文件>" }
  ]
}
```

> 调用前先用 LS/Read 读取 MCP 工具描述文件（`/data/user/mcps/.../tools/push_files.json`）确认参数 schema。

### 8.2 重要约束

- **分支保持 `refactor-plan`，不要合并到 main**
- 每次推进后更新 `REFACTOR_STATUS.md`，勾选任务、添加更新日志
- 提交信息用 conventional commits 格式（feat/fix/docs/refactor）
- 推送前必须通过 TypeScript 编译验证

---

## 九、环境与依赖（本工作区实测）

### 9.1 本地环境

| 项目 | 内容 |
|------|------|
| 工作目录 | `/workspace`（本沙箱）；上一环境路径 `/home/user/.super_doubao/super-doubao-runtime/workspace/AI-analytics-platform/`（阶段一代码曾在此实现，未推送） |
| Node.js | v24.1.0（已实测） |
| npm | 11.4.2（已实测） |
| TypeScript | ^5（devDependency）；系统全局另有 tsc 7.0.2 可通过 `npx --no-install` 调用 |
| Next.js | 16.2.9 |
| React | 19.2.4 |
| tsconfig | `strict: true`（已实测），`noEmit`，路径别名 `@/*` → `./src/*`，moduleResolution=bundler |

### 9.2 关键依赖（package.json 已实测）

- `pg` ^8.22.0 — PostgreSQL 客户端
- `@prisma/client` ^7.8.0 + `@prisma/adapter-pg` ^7.8.0 + `prisma` ^7.8.0 — ORM（注意 Prisma 7 API 变化）
- `openai` ^6.44.0 — AI API
- `recharts` ^3.8.1 — 图表库
- `@base-ui/react` ^1.6.0、`@monaco-editor/react` ^4.7.0、`lucide-react` ^1.21.0、`shadcn` ^4.11.0
- devDeps：vitest ^4.1.10、jsdom ^29.1.1、eslint ^9、tailwindcss ^4

### 9.3 npm scripts（package.json 已实测）

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

### 9.4 当前环境问题

- **npm install 未完成**：`/workspace/node_modules` 不存在，无安装进程在跑
- 已有 `package-lock.json`（lockfileVersion 3），可先尝试 `npm ci`；失败则 `npm install --legacy-peer-deps`
- 安装完成后运行 `npm run typecheck` 验证

---

## 十、风险与注意事项

### 10.1 已识别的风险

| ID | 风险 | 影响阶段 | 缓解措施 |
|----|------|---------|---------|
| R1 | QuerySpec 无法表达复杂 SQL（子查询、窗口函数、CTE） | 阶段三 | 保留 sql 回退；复杂查询走 sql 直通 |
| R2 | 数据轮廓扫描增加查询延迟 | 阶段一/三 | 预计算缓存；仅对小表实时扫描；默认最多 10 个表 |
| R3 | useSession 副作用循环（useEffect 互相触发） | 阶段二 | reducer 中直接处理状态转换，减少 useEffect；仔细设计依赖数组 |
| R4 | 现有图表组件与 render-binder 接口不兼容 | 阶段四 | 适配器层；逐步迁移单个图表类型 |
| R5 | AI 生成的 QuerySpec 字段名与 Schema 不匹配 | 阶段三 | validators 的 schema-based 模式在 INIT_FROM_AI 时拦截 |

### 10.2 实施注意事项

1. **不要破坏现有功能**：每个阶段都要有回滚方案，阶段一的新文件不影响旧代码
2. **TypeScript 严格模式已开启**（strict: true），注意 null 检查和类型安全
3. **参数化查询**：所有用户输入（filter.value、AI 生成的字段值）必须参数化，禁止字符串拼接
4. **SemanticType 兼容性**：现有 pipeline.ts 的 SemanticType 包含 "boolean"，新的 session.ts 也包含，保持一致
5. **ChartMapping 是判别联合**：访问 mapping.x 等字段前需确认 chartType，TypeScript 会自动收窄类型
6. **Next.js 16 App Router**：API 路由在 `src/app/api/` 下，页面在 `src/app/` 下；写代码前先读 `node_modules/next/dist/docs/` 对应指南（Next.js 16 有破坏性变更）
7. **Prisma 7.x**：注意 Prisma 7 的 API 变化（与 Prisma 5/6 不同）

---

## 十一、完整文件清单

### 11.1 阶段一文件（本工作区不存在，需创建/恢复 + 推送）

```
src/types/session.ts          ← 新增，核心类型定义
src/types/actions.ts          ← 新增，SessionAction 联合类型（19 种）
src/lib/query-compiler.ts     ← 新增，QuerySpec → 参数化 SQL
src/lib/validators.ts         ← 新增，双模式统一校验
src/lib/schema-service.ts     ← 修改，追加数据轮廓扫描（现有函数保留）
```

### 11.2 已推送到 GitHub 的文件（refactor-plan 分支，提交 70e8758）

```
docs/REFACTOR_PLAN_v4.md      ← 完整重构方案
REFACTOR_STATUS.md            ← 进度追踪模板（阶段一目前为"待开始"）
```

### 11.3 后续阶段需要创建的文件

```
src/hooks/useSession.ts              ← 阶段二
src/hooks/sessionReducer.ts          ← 阶段二
src/lib/render-binder.ts             ← 阶段四
src/components/SessionView.tsx       ← 阶段四
src/components/SessionList.tsx       ← 阶段四（可选）
src/lib/feedback-recorder.ts         ← 方案中提到，优先级低
```

---

## 十二、给下一个 Agent 的指令

1. **立即执行**：在 `/workspace` 运行 `npm ci`（已有 package-lock.json），失败则 `npm install --legacy-peer-deps`
2. **恢复/实现阶段一代码**：优先检查上一环境 `/home/user/.super_doubao/super-doubao-runtime/workspace/AI-analytics-platform/` 是否仍可访问、是否含 5 个文件；若不可用，按本文档第四节、第五节的设计规格重新实现
3. **编译验证**：`npm run typecheck`，修复 strict 模式下的编译错误
4. **推送阶段一代码**：用 GitHub MCP `push_files` 推送到 `refactor-plan` 分支，一次提交含 5 个文件 + 更新后的 REFACTOR_STATUS.md
5. **开始阶段二**：创建 `useSession.ts` 和 `sessionReducer.ts`，注意：
   - connectionId 和 schema 作为 hook 参数传入
   - reducer 是纯函数，schema 通过参数或闭包传入
   - useEffect 依赖数组要完整，避免循环
   - 覆盖全部 19 种 SessionAction
6. **持续更新**：每完成一个任务，更新 REFACTOR_STATUS.md 并推送
7. **不要合并**：始终在 `refactor-plan` 分支工作，不合并到 main

---

**文档结束。将此文档完整复制给下一个 Agent。**
