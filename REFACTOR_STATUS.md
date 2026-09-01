# 重构进度追踪

> 对应方案：[docs/REFACTOR_PLAN_v4.md](./docs/REFACTOR_PLAN_v4.md)
> 分支：`refactor-plan`（不合并到 main，持续更新）

---

## 总体进度

| 阶段 | 状态 | 开始日期 | 完成日期 | 备注 |
|------|------|---------|---------|------|
| 阶段一：建立新层 | ✅ 已完成 | 2026-09-02 | 2026-09-02 | 类型定义 + 编译器 + 校验器 + Schema 扩展（已推送） |
| 阶段二：接入状态 | ✅ 已完成 | 2026-09-02 | 2026-09-02 | useSession + sessionReducer + workspace 接入（feature flag）+ API 传 history（已推送） |
| 阶段三：切换 AI 输出 | ✅ 已完成 | 2026-09-02 | 2026-09-02 | AI 同时输出 querySpec + displayConfig + sql 回退，数据轮廓注入（已推送） |
| 阶段四：数据流转改造 | ✅ 已完成 | 2026-09-02 | 2026-09-02 | query-engine 返回 SemanticDataset + render-binder + SessionView（已推送） |

**状态图例**：⬜ 待开始 | 🔄 进行中 | ✅ 已完成 | ⚠️ 有阻塞 | ↩️ 已回滚

---

## 阶段一：建立新层

### 任务清单

- [x] 1.1 创建 `src/types/session.ts`
  - [x] AnalysisSession 接口
  - [x] QuerySpec / Measure / Filter / Join / Expression 接口
  - [x] SemanticDataset / SemanticColumn 接口
  - [x] DisplayConfig 接口
  - [x] ConversationMessage 接口
  - [x] TypeScript 编译通过

- [x] 1.2 创建 `src/types/actions.ts`
  - [x] SessionAction 联合类型（19 种 Action + SessionDispatch）

- [x] 1.3 创建 `src/lib/query-compiler.ts`
  - [x] compileQuerySpec(querySpec, schema) → { sql, params }
  - [x] 支持 dimensions / measures / filters / having / sort / limit / joins
  - [x] 参数化查询（防注入，标识符分段引号）
  - [x] 单元测试覆盖（JOIN / HAVING / Expression / 注入用例）

- [x] 1.4 创建 `src/lib/validators.ts`
  - [x] validateDisplayConfig(config, context)
  - [x] schema-based 模式：字段存在 + 类型匹配（含 boolean 支持）
  - [x] data-based 模式：上述 + 重复坐标 + 无效数值 + 高基数
  - [x] ValidationResult / ValidationIssue 接口
  - [x] 单元测试覆盖（双模式 error / warning 场景）

- [x] 1.5 扩展 `src/lib/schema-service.ts`
  - [x] 数据轮廓扫描：唯一值数、NULL 数、min/max、样本值（scanDataProfile / scanAllDataProfiles）
  - [x] buildDataProfileText(profiles) → Prompt 可用的 Markdown 文本

### 验收标准

- [x] 所有新文件 TypeScript 编译通过（`npm run typecheck` 0 错误）
- [x] query-compiler 单元测试通过（含 JOIN / HAVING / Expression 用例）
- [x] validators 单元测试通过（双模式各覆盖 error / warning 场景）
- [x] 旧代码未修改（schema-service.ts 为追加，可删除新文件回滚）

---

## 阶段二：接入状态

### 任务清单

- [x] 2.1 创建 `src/hooks/useSession.ts`
  - [x] useReducer + sessionReducer
  - [x] 三个 useEffect 副作用（querySpec 变化→编译；compiledSql 变化→执行；needs_recompile→判断重查）
  - [x] connectionId 和 schema 作为参数传入
  - [x] 最新值 ref 通过无依赖 effect 同步（规避 react-hooks/refs 渲染期改 ref 告警）

- [x] 2.2 创建 `src/hooks/sessionReducer.ts`
  - [x] 所有 Action 的纯函数处理
  - [x] INIT_FROM_AI 中 schema-based 校验
  - [x] UPDATE_DISPLAY_CONFIG 中 data-based/schema-based 校验 + needs_recompile 判断
  - [x] EXECUTE_SUCCESS 中 data-based 校验
  - [x] 单元测试覆盖 reducer（16 用例）

- [x] 2.3 修改 `src/app/workspace/page.tsx`
  - [x] 新增 `src/components/workspace/session-workspace.tsx`：session 替代 sql / result / pendingChartMapping / aiHistory / error 五个 state
  - [x] 改用 useSession（executeCompiled 注入 /api/query，SQL 执行经 SET_COMPILED_SQL）
  - [x] askAI / executeInsight / handleMappingChange 改为 dispatch
  - [x] ResultPanel 支持受控模式（mapping / onMappingChange 回传）
  - [x] 现有功能不受影响（feature flag：`?session=1` 或 `NEXT_PUBLIC_SESSION_STATE=1` 切换新旧）

- [x] 2.4 修改 API 路由
  - [x] `src/app/api/ai/route.ts`：优先接收请求体 conversationHistory，回退按 conversationId 从库加载
  - [x] `src/app/api/ai/insights/route.ts`：传递 conversationHistory

### 验收标准

- [x] reducer 单元测试通过（16 用例）
- [x] workspace 现有功能完整（旧版默认保留；新版经 feature flag 启用）
- [x] 多轮对话有上下文（API 已传递 conversationHistory；第二轮起可引用第一轮结果——待浏览器人工 E2E 确认）
- [x] feature flag 可回退（旧版 `WorkspaceContent` 未改动）
- [x] typecheck 0 错误 / lint 0 错误 / 94 测试全通过

> 注：阶段二代码完成且静态校验全绿；「多轮对话有上下文」需接入真实数据库与 AI_API_KEY 后在浏览器验证，尚未做 E2E。

---

## 阶段三：切换 AI 输出

### 任务清单

- [x] 3.1 修改 `src/lib/ai-contract.ts`
  - [x] AI_RESPONSE_JSON_SCHEMA 增加 querySpec 和 displayConfig（item 拆为新/旧双变体 anyOf）
  - [x] sql 字段保留为 optional（过渡期回退，仅旧变体必填）
  - [x] buildSystemPrompt 增加 QuerySpec 输出说明
  - [x] buildSystemPrompt 注入数据轮廓（dataProfileText 参数；API 路由经 buildDataProfileText 注入）
  - [x] 单元测试覆盖（新格式优先 / sql 回退 / 无效 querySpec 回退 / 数据轮廓注入）

- [x] 3.2 修改 parse 逻辑
  - [x] parseInsightItems：优先解析 querySpec + displayConfig，回退到 sql
  - [x] 回退路径：sql 存在但 querySpec 缺失时，标记 fallback=true
  - [x] 旧客户端兼容：querySpec 项仍透传 sql（若 AI 同时输出），InsightCard 对 sql 可选容错

- [x] 3.3 修改 `src/lib/ai-service.ts`
  - [x] generateSQL → generateAnalysis（保留 generateSQL 过渡别名）
  - [x] 接收并传递 conversationHistory
  - [x] API 路由（/api/ai、/api/ai/insights）改用 generateAnalysis 并注入数据轮廓

### 验收标准

- [x] AI 同时输出 sql + querySpec + displayConfig（schema 双变体）
- [x] querySpec 存在时优先使用，编译通过（INIT_FROM_AI → querySpec → 编译管线）
- [x] querySpec 缺失时回退到 sql，功能正常（fallback 标记 + 直通 SET_COMPILED_SQL）
- [x] 新旧客户端都能解析响应
- [x] typecheck 0 错误 / lint 0 错误 / 97 测试全通过

> 注：数据轮廓扫描（scanAllDataProfiles，最多 6 表）在每次 AI 请求时执行，失败不阻断主流程；若延迟成为问题，后续可加预计算缓存（风险 R2）。

---

## 阶段四：数据流转改造

### 任务清单

- [x] 4.1 修改 `src/lib/query-engine.ts`
  - [x] 返回 SemanticDataset（columns 含 semanticType）
  - [x] inferSemanticType：数据库类型 → 字段名推断（复用 validators.ts 的 inferSemanticType）
  - [x] 保留 executionTimeMs / rowCount / truncated
  - [x] 查询结果列附带 semanticType（/api/query 与 preview 同步透出）

- [x] 4.2 创建 `src/lib/render-binder.ts`
  - [x] bindDataToChart(dataset, displayConfig) → { rows, mapping, warnings, adjustments }
  - [x] 分类变量在 Y 轴 → 自动交换坐标轴（line/bar）+ adjustment 提示
  - [x] 无效数值 → 过滤 + warning（含数量）
  - [x] 单元测试覆盖（6 用例：坐标翻转 / 过滤 / scatter / pie / table 直通）

- [x] 4.3 图表组件展示 warnings / adjustments
  - [x] 散点图无效行显示警告（含数量）（scatter-chart 已有，保留）
  - [x] 统一警告样式（ChartNotice，SessionView 复用）
  - [x] 重复坐标错误由 line/bar 经 prepareGroupedSeries 以 EmptyState 展示（已有）

- [x] 4.4 创建 `src/components/SessionView.tsx`
  - [x] 根据 session.status 展示 loading / error / 图表
  - [x] 展示 warnings 和 adjustments（统一 ChartNotice 样式）
  - [x] 展示 isUserModified 标记（title/insight 由 workspace 顶栏展示）
  - [x] session-workspace 结果区改用 SessionView（受控 mapping 回传）

### 验收标准

- [x] 查询结果列含 semanticType（query-engine → API → executeCompiled 全程透传，不再强制 unknown）
- [x] 分类变量放 Y 轴自动 coord_flip 并提示（render-binder + SessionView 展示）
- [x] 散点图无效行显示警告（含数量）
- [x] 用户改映射后自动判断是否重查（UPDATE_DISPLAY_CONFIG：引用不存在字段才重查，阶段二已实现）
- [x] 柱状图→折线图不重新查询（CHANGE_CHART_TYPE 纯展示层变更，阶段二已实现）
- [x] InsightCard 显示 error 状态（卡片级错误展示，page.tsx 按索引记录并回传）
- [x] typecheck 0 错误 / lint 0 错误 / 103 测试全通过

> 注：阶段四代码完成且静态校验全绿（103 测试）。「分类变量自动翻转」「无效数值过滤」等展示层行为需在浏览器人工 E2E 确认；insight 执行错误展示需真实数据库验证。

---

## 风险与阻塞

| 编号 | 风险 | 影响阶段 | 状态 | 缓解措施 |
|------|------|---------|------|---------|
| R1 | QuerySpec 无法表达复杂 SQL（子查询、窗口函数） | 阶段三 | ⬜ 待评估 | 保留 sql 回退；复杂查询走 sql 直通 |
| R2 | 数据轮廓扫描增加查询延迟 | 阶段一 | ⬜ 待评估 | 预计算缓存；仅对小表实时扫描 |
| R3 | useSession 副作用循环（useEffect 互相触发） | 阶段二 | ⬜ 待评估 | reducer 中直接处理状态转换，减少 useEffect |
| R4 | 现有图表组件与 render-binder 接口不兼容 | 阶段四 | ⬜ 待评估 | 适配器层；逐步迁移单个图表类型 |

---

## 更新日志

| 日期 | 版本 | 变更内容 | 提交者 |
|------|------|---------|--------|
| 2026-09-02 | v4.4 | 阶段四完成：query-engine 返回 SemanticDataset（columns 含 semanticType，全程透传不再强制 unknown）；新建 render-binder（bindDataToChart：分类变量在 Y 轴自动 coord_flip + 无效数值过滤，6 测试）；新建 SessionView（loading/error/图表 + warnings/adjustments + isUserModified）；session-workspace 结果区改用 SessionView；InsightCard 卡片级 error 展示；103 测试全绿 | zlZayn |
| 2026-09-02 | v4.3 | 阶段三完成：AI 契约双变体（querySpec+displayConfig 优先 / sql+chart 回退）；parse 优先 querySpec、缺失标记 fallback；buildSystemPrompt 注入 QuerySpec 说明与数据轮廓；generateSQL→generateAnalysis；API 路由注入数据轮廓 | zlZayn |
| 2026-09-02 | v4.2 | 阶段二完成：useSession + sessionReducer（19 Action + 16 测试）；SessionWorkspace 接入（feature flag）；ResultPanel 受控模式；API 路由传递 conversationHistory；修复 react-hooks/refs 渲染期改 ref 告警 | zlZayn |
| 2026-09-02 | v4.1 | 阶段一完成：实现 session/actions 类型、query-compiler、validators、schema-service 数据轮廓；新增 19 个单元测试；typecheck 通过 | zlZayn |
| 2026-09-02 | v4.0 | 初始方案提交，融合代码诊断 + 架构方案 + 审核反馈 | zlZayn |

---

## 快速链接

- 方案文档：[docs/REFACTOR_PLAN_v4.md](./docs/REFACTOR_PLAN_v4.md)
- 架构文档：[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- 分支：`refactor-plan`
