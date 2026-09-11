# 决策：AI/R 历史权威源放元库 + R 历史回放改为重新执行

- 日期：2026-09-11
- 状态：已实施
- 范围：`prisma/schema.prisma`、`prisma/migrations/20260911193000_analysis_history/`、`src/app/api/history/`、`src/types/history.ts`、`src/lib/history-client.ts`（原 history-store.ts）、`src/lib/r-bridge.ts`、`src/lib/webr-client.ts`、`src/components/r-workbench/r-workbench.tsx`、`src/app/queries/page.tsx`
- 前序：[统一历史模块与 R 画布](2026-09-11-unified-history-store-and-r-canvas-ownership.md)（§1 的存储介质在此反转）、[统一历史时间线](2026-09-11-unified-history-timeline.md)（其"AI/R 只存浏览器、不跨会话"的边界在此反转）

## 问题（用户可见症状）

1. 重启服务后「查询管理 → 历史」里 SQL 条目还在，AI/R 条目不见了。
2. 历史页点 R 条目的「执行」，有时只有文字输出没有图，有时又能看到图。
3. 需求补充：AI/R 历史也要存元库，"统一管理，不冗余"。

## 根因

- 症状 1：SQL 历史的权威源是后端 `query_history` 表，AI/R 历史却只在浏览器（`sessionStorage`，后改 `localStorage`）——换端口、换浏览器、清站点数据即不可见。
- 症状 2：R 回放只做"载入代码 + 回放文本输出"；图片（`ImageBitmap`）不可序列化，本来就没有图。"有时能出图"是上一轮执行残留在单例里的旧图，与回放的条目无关。
- 附带：只有图、没有文本的执行根本不落库；`stripDataFrameAssignment` 只认"块尾是单独一行 `)`"，遇到单行 `df <- data.frame(x = 1)` 会把其后的分析代码整段吞掉。

## 决策

- **AI/R 历史权威源 = 元库新表 `analysis_history`**（Prisma 模型 `AnalysisHistory`，手写幂等迁移 `prisma/migrations/20260911193000_analysis_history/`）：连接级作用域、每连接保留最新 50 条、写入只追加。SQL 历史仍归 `query_history`，两类读取期由 `lib/history-merge.ts` 合并成统一时间线，绝不双写。
- **一个接口对一类事实**：`GET/POST /api/history`（`kind=ai|r` 可选过滤，`POST` 追加并清理超限旧记录）。
- **客户端不落副本**：`lib/history-client.ts` 只读取与追加（追加失败只记日志，历史不得阻断分析主流程）；旧浏览器记录（键 `analytics-history:v2:<connectionId>`）在进入查询管理页时一次性导入服务端并删除本地键，导入失败保留原键、下次重试。
- **回放 = 重新执行**：`?r=<id>` 打开面板后，等初始化与 `df` 注入完成，先清空输出与图片再重跑该条代码；运行时不可用才退回该条历史的文本输出；id 在库里不存在时明确提示，不退化成"最近一条"。
- **记录补全**：只有图、没有文本的执行同样落库，`imageCount` 记本次图片张数，时间线显示「含图 N 张（回放时重新执行重绘）」。
- **`stripDataFrameAssignment` 按括号配平识别块边界**（先剥字符串字面量），单行与多行写法都剥，取值里的括号与引号不干扰。

## 替代方案（强制）

- **浏览器 localStorage（一度实施后否）**：同源才可见，换端口/换浏览器/清站点数据即丢——正是症状 1 本身。
- **把 SQL 历史也搬进 `analysis_history` 合成一张表**：要迁移既有 `query_history` 行、改 `/api/query` 写路径与行数/耗时徽标口径；SQL 历史没有症状，收益不抵风险。
- **服务端返回"已合并的时间线"**（把 `history-merge` 搬到服务端）：纯函数与单测要跨层搬家，SQL 条目仍需按 `rowCount`/`executionTimeMs` 等独立字段消费；读取期合并已满足"统一浏览"。
- **客户端缓存服务端历史**：双读双写，正是要消除的冗余。
- **图片以 base64 入库**：位图体积大、配额有限，且回放靠重跑更接近"重新分析"的语义。
- **历史写失败阻塞面板**：历史是旁路能力，失败只写日志。

## 影响

- 历史跨浏览器、跨端口、换机器（同元库）都可见；`?r=` 回放链接可分享。
- 元库多一张表（`connections` 删除时级联清理）；每连接上限 50 条，写入时清理更旧记录。
- 浏览器不再持有第二份历史；旧 v2 记录在首次进入查询管理页时自动搬运。
- 历史读写走网络：离线时读取退化为"没有历史"，写入静默失败。

## 验证

- 单测：`history-client.test.ts`（读取 URL/失败退化/追加 JSON/旧记录导入与失败保留/输出截断）、`history-merge.test.ts`（合并与 R 含图提示）、`schema-migration.test.ts`（迁移幂等且不含破坏性语句）、`r-workbench/__tests__`（回放=清空后重跑指定条目、普通打开不执行、运行时不可用退回文本、id 不存在提示、只图也落库）。
- 离线 E2E：`/api/history` 有状态 mock（POST 落库 → 时间线读回），统一历史时间线断言原样通过。
- 联网 + 浏览器：真实连接 `dim_date` 跑 R → 历史页 R 条目「含图 1 张」→ 点「执行」自动重跑出图（未点运行）→ 刷新与新浏览器上下文都能看到该条目。

## 关联

- [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) 历史记录与 R 历史恢复条目 · [../../docs/api.md](../../docs/api.md) 统一历史接口
- [../../prisma/README.md](../../prisma/README.md) · [../../src/lib/README.md](../../src/lib/README.md) · [../../src/components/r-workbench/README.md](../../src/components/r-workbench/README.md)
- [../../docs/verification.md](../../docs/verification.md)
