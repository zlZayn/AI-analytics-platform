# 决策：执行契约统一 + 工作台会话持久化（2026-09-11）

已实施

## 问题

- 同一件事有三种进入方式，只有两条能跑通：编辑器执行与导航带 SQL 走 `SET_COMPILED_SQL`（新对象 → 必执行）；洞察卡片走 `INIT_FROM_AI`（把状态置回 `compiling` 并清空 `compiledSql`）。
- 编译副作用按 `JSON.stringify(querySpec)` 去重，命中即静默 return：卡片再次执行同一份 spec（含「首条已自动执行过的卡片」）时没有任何动作落地，状态永远停在 `compiling`，`busy` 恒真 → 卡片永久转圈。
- 结果区只看旧结果仍可渲染，所以既有 E2E（只断言 `chart-surface` 可见）没能发现它。
- 工作台组件按 `connection:sql` key 挂载（`app/workspace/page.tsx`）：切页/刷新即整体丢失，AI 对话、洞察卡片、SQL 草稿、展示配置全没了。

## 决策

- **执行请求显式化**：`AnalysisSession` 增加 `runId`，`INIT_FROM_AI` 递增；编译指纹改为 `runId + querySpec`。状态机契约：任何入口触发的执行请求都必须真的执行一次，编译去重只允许吞掉「渲染重复且无新请求」。
- **工作台按连接持久化**：`lib/workspace-store.ts` 用 sessionStorage 存「会话骨架 + 洞察流」，进入工作台时恢复；**结果行不持久化**（体量与权威性都属于服务端），瞬态状态（compiling/executing）恢复为 ready，恢复后点一次「执行」即可重看。
- **恢复边界**（E2E 逼出来的三条，写进实现）：恢复不带 `compiledSql`/`querySpec`（两者任一非空都会触发编译/执行副作用，一进工作台就自动重跑，导航入口「只发一次 query」的断言会直接失败）；持久化立即写、不防抖（组件卸载时 cleanup 会取消定时器，丢掉最后一刻的状态）；洞察可见性与查询结果解耦（`SessionView` 在有洞察时就渲染 Tabs，结果为空时两个数据面板提示「未保留，点执行重看」），恢复后默认停在「洞察」Tab。
- **回归守卫**：`useSession` 级测试断言「同一份 spec 再次执行会执行第二次且状态回到 ready」（撤掉修复即失败）；离线 E2E 断言卡片按钮离开加载态、同卡片再执行真的再发一次 `/api/query`、切页回来洞察仍在且结果为空态。

## 替代方案

- 只修卡片（点执行前先清空 querySpec 强制重编译）：把状态机漏洞留在原地，下一个入口还会踩。
- 在 hook 里客户端编译再直发 `SET_COMPILED_SQL`：编译逻辑出现第二份，违背单一来源。
- 把会话/洞察写进数据库（`aIMessage` 等）：本平台元库与业务表同库，schema 演进需手写 ALTER，代价与风险都高于当前诉求；先做本地持久化，跨设备再谈。
- 持久化结果行：sessionStorage 配额与「结果属于服务端」都不支持，且可能被误当权威数据。

## 影响

- 三个执行入口收敛到同一条落地路径；`runId` 成为「执行意图」的唯一标记。
- 切页/刷新后：AI 对话与洞察卡片保留，查询结果需一次点击重跑。
- 新增测试：`workspace-store.test.ts`（5 例）、`useSession-execution.test.tsx`（2 例，含反向验证）。
