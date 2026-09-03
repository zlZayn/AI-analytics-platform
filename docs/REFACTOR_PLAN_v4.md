# AI 分析平台重构实施方案（融合版）

版本：4.0 | 基于：代码诊断 + 架构方案 + 审核反馈 | 状态：已实施（v4.5，见 [REFACTOR_STATUS.md](../REFACTOR_STATUS.md)）

---

## 第一部分：哲学思想（一句话说清楚）

### 核心矛盾

当前代码用 "事件处理" 的方式写程序：用户点按钮 → 改三个 state → 三个 state 各自触发渲染 → state 之间隐式依赖、相互覆盖。

### 解决方向

改用 "状态描述" 的方式：用户任何操作 → 修改唯一状态对象（Session）→ 系统根据状态计算出应该显示什么。

### 一句话

状态是唯一的真相，视图是状态的函数，操作是状态的转换。

---

## 第二部分：核心数据模型（唯一真相）

以下所有类型定义在 `src/types/session.ts` 中，是唯一数据源，所有模块共享。

### 2.1 AnalysisSession（核心状态容器）

```typescript
// src/types/session.ts

interface AnalysisSession {
  // ---- 身份 ----
  id: string;

  // ---- 用户意图 ----
  question: string;          // 用户原始问题
  title: string;             // AI 生成或用户命名
  insight: string;           // AI 结论或用户注释

  // ---- 查询层（决定"查什么"） ----
  querySpec: QuerySpec;      // 结构化查询

  // ---- 编译层 ----
  compiledSql: {
    sql: string;
    params: any[];           // ← 参数化查询，防注入
  } | null;

  // ---- 数据层（查询结果） ----
  result: SemanticDataset | null;

  // ---- 呈现层（决定"怎么画"） ----
  displayConfig: DisplayConfig;

  // ---- 状态 ----
  status: 'idle' | 'compiling' | 'executing' | 'ready' | 'error' | 'needs_recompile';
  error?: string;
  source: 'ai' | 'user';     // 当前主导方
  isUserModified: boolean;

  // ---- 上下文（多轮对话） ----
  conversationHistory: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  // assistant 消息额外携带结构化数据
  metadata?: {
    title?: string;
    insight?: string;
    querySpec?: QuerySpec;
    displayConfig?: DisplayConfig;
  };
}
```

**与现有代码的关系：**

- 替代 `sql`、`result`、`pendingChartMapping`、`aiHistory`、`error` 五个独立 state
- 与现有 `QueryResult` 类型兼容（SemanticDataset 继承自它）

---

### 2.2 QuerySpec（查询规范）

```typescript
// src/types/session.ts

interface QuerySpec {
  // 数据来源（默认从 schema 推断）
  table?: string;

  // 维度（GROUP BY）
  dimensions: (string | Expression)[];

  // 度量（聚合）
  measures: Measure[];

  // 筛选（WHERE）
  filters: Filter[];

  // 聚合后筛选（HAVING）
  having?: Filter[];

  // 排序
  sort?: { field: string; direction: 'asc' | 'desc' }[];

  // 行数限制
  limit?: number;

  // JOIN（可选）
  joins?: Join[];
}

interface Expression {
  type: 'date_trunc' | 'extract' | 'concat';
  args: Record<string, any>;
  alias: string;
}

interface Measure {
  field: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';
  alias?: string;
}

interface Filter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'is_null';
  value?: any;
}

interface Join {
  type: 'inner' | 'left' | 'right';
  table: string;
  on: { left: string; right: string };
}
```

**与现有代码的关系：**

- 新增类型，现有代码中无对应
- AI 输出的 `sql` 字段保留作为回退（过渡期）

---

### 2.3 SemanticDataset（带语义的数据集）

```typescript
// src/types/session.ts

interface SemanticDataset {
  columns: SemanticColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;   // 兼容现有 QueryResult
}

interface SemanticColumn {
  name: string;
  databaseType: string;      // 来自 pg 的 oid 映射
  semanticType: 'numeric' | 'categorical' | 'temporal' | 'text' | 'identifier' | 'unknown';
}
```

**与现有代码的关系：**

- 继承现有 `QueryResult`，增加 `columns.semanticType`
- `query-engine.ts` 返回此类型
- `transform.ts` 优先使用 `semanticType`，不再盲猜

---

### 2.4 DisplayConfig（呈现配置）

```typescript
// src/types/session.ts

interface DisplayConfig {
  chartType: ChartType;      // 复用现有 ChartType
  mapping: ChartMapping;     // 复用现有 ChartMapping
  showLegend?: boolean;
  mode?: 'grouped' | 'stacked' | 'normalized';
}
```

**与现有代码的关系：**

- 直接复用现有 `ChartType` 和 `ChartMapping` 类型
- 现有 `ChartConfigPanel` 的 `mapping` 和 `chartType` 合并到此对象中

---

## 第三部分：模块改造清单（每处改动与谁对接）

按修改/新增/删除分类，每项标注 **输入 → 输出** 和 **依赖方**。

### 3.1 新增文件（6 个）

| 文件 | 职责 | 输入（来自谁） | 输出（给谁） |
|------|------|---------------|------------|
| `types/session.ts` | 所有类型定义 | 无（基础类型） | 所有模块 |
| `types/actions.ts` | SessionAction 定义 | `types/session.ts` | `useSession`、`workspace/page.tsx` |
| `lib/query-compiler.ts` | QuerySpec → SQL（参数化） | QuerySpec（来自 session）+ SchemaData（来自 schema-service） | `{ sql, params }` → `useSession` |
| `lib/render-binder.ts` | Dataset + Config → 视图数据 | SemanticDataset（来自 session）+ DisplayConfig（来自 session） | `{ chartData, warnings, adjustments }` → 图表组件 |
| `lib/validators.ts` | 统一校验（双模式） | DisplayConfig + SchemaData 或 SemanticDataset | `ValidationResult` → 调用方 |
| `hooks/useSession.ts` | Session 管理 + 副作用 | connectionId（来自 props）+ schema（来自 schema-service） | `{ session, dispatch }` → `workspace/page.tsx` |

### 3.2 大幅修改文件（7 个）

| 文件 | 改动内容 | 与谁对接 |
|------|---------|--------|
| `lib/ai-contract.ts` | AI 输出增加 `querySpec` 和 `displayConfig`，保留 `sql`（过渡期） | `ai-service.ts` → `workspace/page.tsx` |
| `lib/ai-service.ts` | `generateAnalysis` 接收 `conversationHistory` | `api/ai/route.ts` |
| `lib/query-engine.ts` | 返回 SemanticDataset（含 semanticType） | `useSession` → 图表组件 |
| `lib/schema-service.ts` | 增加数据轮廓扫描（唯一值数、NULL率、样本值） | `ai-contract.ts`（Prompt 构建）+ `query-compiler.ts` |
| `app/workspace/page.tsx` | 删除 5 个 state，改用 `useSession` | 所有子组件通过 props 接收 session 和 dispatch |
| `components/result-panel.tsx` | 改为受控组件，增加 `onMappingChange` 回传 | `workspace/page.tsx` |
| `components/insight-card.tsx` | 增加 error 状态展示 | `workspace/page.tsx` |

### 3.3 删除或收窄的文件（4 个）

| 文件 | 改动 |
|------|------|
| `lib/pipeline.ts` | `validateChartMapping` 迁移到 `validators.ts`，`profileData`/`recommendCharts`/`createMappingForChart` 保留 |
| `lib/transform.ts` | 删除 `finiteNumber` 盲猜逻辑，其他函数保留（`prepareGroupedSeries`、`sampleScatterData` 等） |
| `components/charts/mapping.ts` | 删除 `createChartMapping`（迁移到 `pipeline.ts` 的 `createMappingForChart`） |
| `components/chart-config-panel.tsx` | 增加 `onChartTypeChange` 回调，其他不变 |

---

## 第四部分：完整数据流（端到端）

每一步标注 **触发者 → 处理者 → 状态变化 → 输出**。

### 4.1 场景：用户提问

```
1. 用户输入问题
   触发者：用户
   处理者：workspace/page.tsx 的 askAI()
   动作：dispatch({ type: 'ASK_AI', payload: { question } })
   → 状态变化：session.status = 'compiling'

2. AI 生成
   触发者：workspace 调用 /api/ai
   处理者：ai-service.ts → ai-contract.ts
   动作：调用 OpenAI，返回 { title, insight, querySpec, displayConfig }
   → 输出：包含 querySpec（不含 SQL）

3. 存入 Session
   触发者：workspace 收到响应
   处理者：dispatch({ type: 'INIT_FROM_AI', payload: { querySpec, displayConfig, title, insight } })
   动作：sessionReducer 更新状态
   → 状态变化：session.querySpec = ..., session.displayConfig = ..., session.status = 'idle'

4. 自动编译（副作用触发）
   触发者：useSession 的 useEffect 监听到 querySpec 变化
   处理者：query-compiler.ts
   动作：compileQuerySpec(querySpec, schema) → { sql, params }
   → 状态变化：session.compiledSql = { sql, params }, session.status = 'compiling'

5. 自动执行（副作用触发）
   触发者：useSession 的 useEffect 监听到 compiledSql 变化
   处理者：query-engine.ts
   动作：executeQuery(connectionId, sql, params) → SemanticDataset
   → 状态变化：session.result = dataset, session.status = 'ready'

6. 自动渲染（UI 响应）
   触发者：session 变化驱动 React 重新渲染
   处理者：SessionView 组件 → render-binder.ts
   动作：bindDataToChart(dataset, displayConfig) → { chartData, warnings, adjustments }
   → 输出：图表 + 警告 + 调整说明
```

### 4.2 场景：用户修改映射

```
1. 用户下拉框改 X 轴
   触发者：用户操作 ChartConfigPanel
   处理者：调用 props.onChange(newMapping)
   → 向上传递到 ResultPanel → workspace/page.tsx

2. 触发 Action
   触发者：workspace
   处理者：dispatch({ type: 'UPDATE_DISPLAY_CONFIG', payload: { mapping: newMapping } })
   → 状态变化：session.displayConfig.mapping = newMapping, session.status = 'needs_recompile'

3. 判断是否需要重查（副作用触发）
   触发者：useSession 的 useEffect 监听到 status === 'needs_recompile'
   处理者：检查新字段是否在 session.result.columns 中
   → 如果在：session.status = 'ready'（只重新渲染）
   → 如果不在：更新 querySpec，触发编译→执行（走 4.1 的步骤 4-6）
```

---

## 第五部分：统一校验体系

所有校验收束到 `lib/validators.ts`，一处定义，全局使用。

### 5.1 双模式设计

```typescript
function validateDisplayConfig(
  config: DisplayConfig,
  context: SchemaData | SemanticDataset,
  mode: 'schema-based' | 'data-based'
): ValidationResult
```

| 模式 | 使用场景 | 校验内容 | 数据来源 |
|------|---------|---------|--------|
| schema-based | AI 生成后立即校验 | 字段存在性 + 类型匹配 | SchemaData（表结构） |
| data-based | 执行后校验（含用户修改） | 上述 + 重复坐标 + 数据质量 | SemanticDataset（实际数据） |

### 5.2 校验项

| 校验项 | schema-based | data-based | 错误级别 |
|--------|:----------:|:---------:|--------|
| 字段是否存在 | ✅ | ✅ | error |
| 槽位类型匹配（Y 轴须 numeric） | ✅ | ✅ | error |
| 重复坐标（line/bar 的 x+color） | ❌ | ✅ | warning |
| 无效数值（Y 轴含非数值） | ❌ | ✅ | warning |
| 唯一值过多（分组字段 > 50 个） | ❌ | ✅ | warning |

### 5.3 调用方

| 调用位置 | 模式 | 触发时机 |
|---------|------|--------|
| `INIT_FROM_AI` reducer | schema-based | AI 返回后 |
| `UPDATE_DISPLAY_CONFIG` action | data-based（如有 result）/ schema-based（无 result） | 用户修改映射时 |
| `EXECUTE_SUCCESS` reducer | data-based | 查询执行后 |

---

## 第六部分：迁移计划（分四阶段，每阶段可回滚）

### 阶段一：建立新层（1 周）

| 任务 | 文件 | 产出 | 验收 |
|------|------|------|------|
| 定义类型 | `types/session.ts`、`types/actions.ts` | 所有新类型 | TypeScript 编译通过 |
| 实现编译器 | `lib/query-compiler.ts` | QuerySpec → 参数化 SQL | 单元测试覆盖 |
| 实现校验器 | `lib/validators.ts` | 双模式校验 | 单元测试覆盖 |
| 扩展 Schema | `lib/schema-service.ts` | 增加数据轮廓扫描 | 能获取唯一值数、NULL率 |

**回滚方式**：所有新文件独立存在，旧代码未改，直接删除新增文件即可回滚。

### 阶段二：接入状态（1 周）

| 任务 | 文件 | 产出 | 验收 |
|------|------|------|------|
| 实现 useSession | `hooks/useSession.ts` | Session 管理 + 副作用 | 单元测试覆盖 reducer |
| 接入 workspace | `app/workspace/page.tsx` | 替换 5 个 state | 现有功能不受影响 |
| 修改 API | `api/ai/route.ts`、`api/ai/insights/route.ts` | 传递 conversationHistory | 多轮对话有上下文 |

**回滚方式**：`workspace/page.tsx` 保留旧 state，通过 feature flag 切换。

### 阶段三：切换 AI 输出（1 周）

| 任务 | 文件 | 产出 | 验收 |
|------|------|------|------|
| 修改 AI 契约 | `lib/ai-contract.ts` | AI 同时输出 sql + querySpec（过渡期） | 新旧客户端都能解析 |
| 修改 parse 逻辑 | `lib/ai-contract.ts` | 优先使用 querySpec，回退 sql | 回退路径经过测试 |

**回滚方式**：AI 同时输出新旧格式，客户端自动降级。

### 阶段四：数据流转改造（1 周）

| 任务 | 文件 | 产出 | 验收 |
|------|------|------|------|
| 修改 query-engine | `lib/query-engine.ts` | 返回 SemanticDataset | semanticType 贯穿 |
| 实现 render-binder | `lib/render-binder.ts` | 适配数据，返回 warnings | 分类变量自动 coord_flip |
| 修改图表组件 | `components/charts/views/*.tsx` | 展示 warnings 和 adjustments | 用户看到数据被过滤的提示 |

**回滚方式**：保留旧 `transform.ts` 作为 fallback，通过配置切换。

---

## 第七部分：接口契约总表

模块间所有接口，输入输出清晰。

| 调用方 | 被调用方 | 输入 | 输出 |
|-------|---------|------|------|
| `workspace/page.tsx` | `useSession()` | `{ connectionId, schema }` | `{ session, dispatch }` |
| `workspace/page.tsx` | `/api/ai` | `{ connectionId, message, history }` | `{ items: [{ title, insight, querySpec, displayConfig }] }` |
| `useSession` (effect) | `query-compiler.compileQuerySpec` | `(querySpec, schema)` | `{ sql, params }` |
| `useSession` (effect) | `query-engine.executeQuery` | `(connectionId, sql, params)` | `SemanticDataset` |
| `useSession` (effect) | `validators.validateDisplayConfig` | `(displayConfig, context, mode)` | `ValidationResult` |
| `SessionView` | `render-binder.bindDataToChart` | `(dataset, displayConfig)` | `{ chartData, warnings, adjustments }` |
| `ChartConfigPanel` | workspace (via callback) | `(newMapping)` | 触发 `UPDATE_DISPLAY_CONFIG` |

---

## 第八部分：统一状态变更表

所有 Action 在 `sessionReducer` 中的处理逻辑，一处定义，全局生效。

| Action | 状态变更 | 副作用触发（useEffect） |
|--------|---------|----------------------|
| `ASK_AI` | 无（仅标记请求中） | 调用 AI API → 触发 `INIT_FROM_AI` |
| `INIT_FROM_AI` | 填充 querySpec/displayConfig/title/insight，status='idle' | querySpec 变化 → 自动编译 |
| `UPDATE_QUERY_SPEC` | 更新 querySpec，status='idle' | querySpec 变化 → 自动编译 |
| `UPDATE_DISPLAY_CONFIG` | 更新 displayConfig，isUserModified=true | 检查是否需要重查 → 更新 querySpec 或 status='ready' |
| `CHANGE_CHART_TYPE` | 更新 displayConfig.chartType | status='ready'（只重渲染） |
| `EXECUTE_QUERY` | status='executing' | compiledSql 变化 → 执行查询 |
| `EXECUTE_SUCCESS` | result=dataset，status='ready' | 无 |
| `EXECUTE_FAILURE` | error=message，status='error' | 无 |
| `SET_STATUS` | status=newStatus | 取决于具体状态值 |
| `RESET` | 回到初始状态 | 无 |

---

## 第九部分：与现有代码的兼容点

确保过渡期不破坏现有功能。

| 现有代码 | 兼容方式 | 过渡期结束后的处理 |
|---------|---------|------------------|
| AI 输出的 `sql` 字段 | 保留在 querySpec 旁，作为回退 | 移除，只保留 querySpec |
| `ChartMapping` 类型 | 直接复用，作为 `DisplayConfig.mapping` | 不变 |
| `QueryResult` 类型 | SemanticDataset 继承之，增加 semanticType | 逐步迁移 |
| `transform.ts` 的 `prepareGroupedSeries` | 保留，render-binder 调用它 | 不变 |
| `pipeline.ts` 的 `profileData`/`recommendCharts` | 保留，ChartConfigPanel 仍需要 | 不变 |

---

## 第十部分：最终说明

### 这份文档覆盖了什么

- 哲学思想：为什么这样做
- 数据模型：用什么结构承载状态
- 模块清单：每个文件改什么、输入输出、依赖方
- 数据流：端到端的完整路径
- 校验体系：统一校验的双模式设计
- 迁移计划：分四阶段，每阶段可回滚
- 接口契约：模块间的所有接触点
- 状态变更：所有 Action 的处理逻辑
- 兼容策略：如何不破坏现有功能

### 这份文档不覆盖什么

- 具体每行代码怎么写（实施时展开）
- 测试用例设计（按验收清单编写）
- 部署和运维配置

### 一句话

所有问题已收束到这份文档中。按此实施，状态统一、类型贯穿、校验一致、查询呈现解耦、多轮对话完整、迁移可回滚。
## 文档导航
- 进度追踪 [REFACTOR_STATUS.md](../REFACTOR_STATUS.md) · 设计决策 [ARCHITECTURE.md](ARCHITECTURE.md)
