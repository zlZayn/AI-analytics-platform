# 决策：统一历史时间线（SQL/AI/R 合并浏览与回放）

- 日期：2026-09-11
- 状态：已实施
- 范围：`src/lib/history-store.ts`（v2）、`src/lib/history-merge.ts`（新增）、`src/components/history-timeline.tsx`（新增）、`src/app/queries/page.tsx`、`src/lib/workspace-navigation.ts`、`src/components/SessionView.tsx`、`src/components/r-workbench/r-workbench.tsx`、`src/components/workspace/session-workspace.tsx`、`src/app/workspace/page.tsx`、`src/hooks/useAiAssistant.ts`
- 前序：[2026-09-11-unified-history-store-and-r-canvas-ownership.md](2026-09-11-unified-history-store-and-r-canvas-ownership.md)（统一存储模块本记录，其 §1 的作用域键已被本记录改为 connectionId）

## 问题

查询管理页「历史」只有后端 SQL 执行历史；AI 提问与 R 执行落在前端 `history-store` 但没有任何 UI 入口。
两套历史连隔离轴都不一致：后端按 `connectionId`，前端键名义 `connectionId` 实际存 `session.id`。
用户要求：UI 里可浏览统一历史，不跨会话持久，设计不冗余。

## 决策

- **存储分层不动，UI 合一，键统一**：一条历史 = 一个事件流；谁是权威源谁存，读取期合并，绝不双写。
  SQL 历史权威源是后端 `QueryHistory` 表；AI/R 历史权威源是 sessionStorage。
- **history-store v2**：作用域键 = `connectionId`（与后端历史同轴）；记录新增 `sessionId` 溯源字段；
  R 记录新增 `sourceSql`（执行时结果集来源 SQL，回放重跑 df 用）。v1 键（`session.id` 作用域）直接放弃——sessionStorage 本就易失。
- **合并逻辑纯函数化**：`lib/history-merge.ts` 把两来源归一成 `TimelineItem`（kind: sql/ai/r），按 `createdAt` 倒序、
  同刻 SQL 优先、非法时间排末尾不丢弃；`filterTimeline` 匹配标题与代码。UI 组件 `history-timeline.tsx` 只渲染与回调。
- **回放动作按能力降级，不假装能重放**：
  - SQL → 带 SQL 直达工作台执行（既有契约）
  - AI → 仅当存在通过只读预检的回退 SQL（`sqlValid`）才给「执行」；querySpec 洞察编译产物含参数占位符，不经编译不可得，故只给「复制问题」
  - R → 「执行」= 带 `sourceSql` 直达工作台 + URL 追加 `r=<history id>`；工作台结果就绪后自动打开面板，按 id 从 history-store 取回该条代码（剥旧 `df` 块重建的既有规则不变）；无 `sourceSql` 的旧记录只给「复制代码」
- **R 代码不进 URL**：sessionStorage 同标签页共享，按 id 解析即可；URL 只带短 id，避免超长查询串。

## 替代方案（强制）

- **SQL 历史双写进 history-store 凑单存储**：同一事件两份记录、保留策略不同（50 条上限 vs 后端全量），典型冗余，且后端写路径要动查询接口。
- **全部收进后端单表（AI/R 上服务端）**：需求是会话内回看，不需要跨会话持久；元库加表要手写 `ALTER TABLE`，成本大于收益。
- **AI 历史按 querySpec 现场编译出 SQL 再回放**：合并层做不了带 schema 校验的编译（编译是工作台职责），为回放复制一份编译逻辑违反单一映射；接受降级为复制。
- **R 回放经 URL 传代码**：代码可达 4000+ 字符，查询串爆炸且可分享性无意义（历史本就会话级）。
- **新建独立「历史」路由页**：queries 页已有 收藏/历史 双标签，再加导航面是重复入口。

## 顺带修复（同一改动内）

- **R 面板初始化失败重复报错**：bootstrap 的 `catch` 未检查 `cancelled`——StrictMode 双跑时两轮 await 同一份失败的 `initPromise`，各报一条「R 环境初始化失败」。
  离线 E2E 在 dev 服务器下因 strict-mode 定位器冲突必挂（main 上即可复现），加 `if (cancelled) return` 后 dev/prod 都过。
- **离线 E2E 的 AI mock 缺 `sqlValid`**：`fallbackSqlOf` 门控（见 ai-session-mapping）引入后，mock 不经服务端解析、卡片永远不可执行，洞察执行回归段超时（main 上即可复现）。mock 补 `sqlValid: true` 对齐真实解析产物。

## 影响

- 查询管理页「历史」成为统一时间线（徽标区分 SQL/AI/R，搜索同时匹配三者）；计数含本地历史。
- 历史浏览依赖 sessionStorage：新标签页/重启浏览器后只剩 SQL 历史——这是需求边界（不跨会话持久），非缺陷。
- R 工作台 props 更名 `scopeId → connectionId` 并新增 `sessionId`/`sourceSql`/`replayId`；AI 历史落库改用真实连接 id。
- 版本 1.33.1 → 1.34.0（功能/行为 minor），bump 后需重建才在侧栏徽标生效。

## 验证

- 单测：`history-merge.test.ts`（合并排序/同刻稳定/非法时间/动作可用性/复制文本/过滤/aiOpenableSql）、`history-store.test.ts`（v2 作用域/sessionId 溯源/sourceSql/rHistoryById）、`workspace-navigation.test.ts`（buildHistoryWorkspaceUrl/parseRHistoryParam）。
- 离线 E2E（prod 构建）：全绿，含新增「统一历史时间线」回归段（SQL+AI 徽标同屏、AI 问题可见）与 R 错误态单元素断言。
- 待联网人工验收：R 历史「执行」→ 自动开面板回放（见 docs/verification.md）。

## 关联

- [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) 防错清单（历史记录条目已更新为 v2 语义）
- [../../src/lib/README.md](../../src/lib/README.md) · [../../src/components/README.md](../../src/components/README.md) · [../../src/app/queries/README.md](../../src/app/queries/README.md)
