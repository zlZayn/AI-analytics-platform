# 重构进度追踪

> 对应方案：[docs/REFACTOR_PLAN_v4.md](./docs/REFACTOR_PLAN_v4.md)
> 分支：`refactor-plan`（不合并到 main，持续更新）

---

## 总体进度

| 阶段 | 状态 | 开始日期 | 完成日期 | 备注 |
|------|------|---------|---------|------|
| 阶段一：建立新层 | ✅ 已完成 | 2026-09-02 | 2026-09-02 | 类型定义 + 编译器 + 校验器 + Schema 扩展（已推送） |
| 阶段二：接入状态 | ✅ 已完成 | 2026-09-02 | 2026-09-02 | useSession + sessionReducer + workspace 接入（feature flag）+ API 传 history（已推送） |
| 阶段三：切换 AI 输出 | ⬜ 待开始 | | | AI 同时输出 sql + querySpec，优先 querySpec |
| 阶段四：数据流转改造 | ⬜ 待开始 | | | SemanticDataset + render-binder + 图表展示 warnings |

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

- [ ] 3.1 修改 `src/lib/ai-contract.ts`
  - [ ] AI_RESPONSE_JSON_SCHEMA 增加 querySpec 和 displayConfig
  - [ ] sql 字段保留为 optional（过渡期回退）
  - [ ] buildSystemPrompt 增加 QuerySpec 输出说明
  - [ ] buildSystemPrompt 注入数据轮廓（buildDataProfile）

- [ ] 3.2 修改 parse 逻辑
  - [ ] parseAnalysisItems：优先解析 querySpec，回退到 sql
  - [ ] 回退路径：sql 存在但 querySpec 缺失时，标记为 fallback 模式

- [ ] 3.3 修改 `src/lib/ai-service.ts`
  - [ ] generateSQL → generateAnalysis
  - [ ] 接收并传递 conversationHistory

### 验收标准

- [ ] AI 同时输出 sql + querySpec + displayConfig
- [ ] querySpec 存在时优先使用，编译通过
- [ ] querySpec 缺失时回退到 sql，功能正常
- [ ] 新旧客户端都能解析响应

---

## 阶段四：数据流转改造

### 任务清单

- [ ] 4.1 修改 `src/lib/query-engine.ts`
  - [ ] 返回 SemanticDataset（columns 含 semanticType）
  - [ ] inferSemanticType：Schema 优先 → 数据库类型 → 字段名推断
  - [ ] 保留 executionTimeMs / rowCount / truncated

- [ ] 4.2 创建 `src/lib/render-binder.ts`
  - [ ] bindDataToChart(dataset, displayConfig) → { chartData, warnings, adjustments }
  - [ ] 分类变量在 Y 轴 → 自动 coord_flip + adjustment 提示
  - [ ] 无效数值 → 过滤 + warning（含 count）
  - [ ] 调用现有 prepareGroupedSeries / sampleScatterData 等

- [ ] 4.3 修改图表组件
  - [ ] `components/charts/views/*.tsx`：展示 warnings 和 adjustments
  - [ ] 散点图显示 invalidCount 警告
  - [ ] 所有图表统一警告样式

- [ ] 4.4 创建 `src/components/SessionView.tsx`
  - [ ] 根据 session.status 展示 loading / error / 图表
  - [ ] 展示 title / insight / isUserModified 标记
  - [ ] 展示 warnings 和 adjustments

### 验收标准

- [ ] 查询结果列含 semanticType
- [ ] 分类变量放 Y 轴自动 coord_flip 并提示
- [ ] 散点图无效行显示警告（含数量）
- [ ] 用户改映射后自动判断是否重查
- [ ] 柱状图→折线图不重新查询
- [ ] InsightCard 显示 error 状态

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
| 2026-09-02 | v4.2 | 阶段二完成：useSession + sessionReducer（19 Action + 16 测试）；SessionWorkspace 接入（feature flag）；ResultPanel 受控模式；API 路由传递 conversationHistory；修复 react-hooks/refs 渲染期改 ref 告警 | zlZayn |
| 2026-09-02 | v4.1 | 阶段一完成：实现 session/actions 类型、query-compiler、validators、schema-service 数据轮廓；新增 19 个单元测试；typecheck 通过 | zlZayn |
| 2026-09-02 | v4.0 | 初始方案提交，融合代码诊断 + 架构方案 + 审核反馈 | zlZayn |

---

## 快速链接

- 方案文档：[docs/REFACTOR_PLAN_v4.md](./docs/REFACTOR_PLAN_v4.md)
- 架构文档：[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- 分支：`refactor-plan`
