# 实现状态与续作上下文

更新时间：2026-07-25

## Git 状态

- 开发分支：`codex/complete-analytics-refactor`
- 基线：`main` 的 `3b918d4 chore: ignore local worktrees`
- 工作树：`E:\新下载\ai-data-analytics\.worktrees\complete-analytics-refactor`
- 本文件写入时尚待最终提交并合并到 `main`；合并后必须在本节记录实际提交号。
- 主工作区原有 `package-lock.json` 与 `.omo/` 不属于本轮改动，合并时不得覆盖或清理。

## 已完成

- 查询：单条 SELECT/WITH、PostgreSQL 只读事务、数据库 statement timeout、真实 `pg_cancel_backend` 取消、5,000 行硬上限和安全失败历史。
- 连接：有限 PoolRegistry、并发创建去重、闲置/LRU 回收、更新/删除/认证错误失效；Schema active 快照事务切换和部分唯一索引迁移。
- API：所有 Route Handler 使用统一 `ApiResponse<T>`；客户端统一处理 HTTP、非 JSON、超时、Abort 和 requestId。
- 探索预览：新增 `/api/query/preview`，客户端只传 connectionId/schema/table，服务端引用标识符并复用查询引擎，限制 100 行。
- 图表合同：`ChartMapping` 改为无字符串兜底、无索引签名的判别联合；算法、变换、Worker 和视图解耦，删除重复统计实现。
- 图表算法：Type 7 箱线、FD/Sturges 直方、Pearson/Spearman/Kendall tau-b、成对删除及每格 n；相关矩阵在可取消 Worker 中计算。
- 显示边界：折线时间排序/空值断线/重复坐标错误；柱状显式分组/堆叠/百分比；散点严格过滤和 2,000 点确定性分层抽样；饼图非负校验和前 8 类“其他”；热力图缺失/零分离、重复检测及顺序/发散色阶。
- 使用体验：点击图表后按完整画像填入合法默认映射；结果表窗口化、粘性表头、NULL 标记、列宽持久化和键盘滚动；Error Boundary 自动重置、手动重试和安全文案；最新请求身份保护。
- AI：领域中立提示词、当前 Schema 注入、供应商原生 strict JSON Schema、运行时 SQL/图表/槽位/输出别名校验、可注入 provider；测试不调用真实 API。
- 视觉：产品只保留集中 token 管理的专业亮色；移动导航、四视口布局和自绘矩阵居中已检查。
- 文档：README、设计哲学、API、AI、模块、图表、测试、运维、页面结构和人工验收已同步，旧 EXPLAIN/文本 SQL/8 图表说明已删除。

## 自动验证

最终提交前的最近结果：

```text
npm test                         18 files / 53 tests passed
npm run typecheck                passed
npm run lint                     passed
npm run build                    passed (Next.js 16.2.9)
git diff --check                 passed
python scripts/final_ui_smoke.py passed at 360/768/1280/1440
python scripts/offline_workspace_e2e.py passed; all 10 views selected
```

烟测截图输出到 Git 忽略的 `.artifacts/`。本机平台数据库密码无效时，`/api/connections` 会返回安全 500；烟测仅把“该已知离线响应且错误状态可见”视为允许，其他 HTTP/页面/控制台错误仍失败。

## 仍需人工完成

自动化不能替代以下外部验证，不属于遗留代码 TODO：

1. 使用真实只读 PostgreSQL 账号验证写语句被数据库拒绝、长查询取消、认证失效池清理和连接删除。
2. 使用包含 5,000+ 行、空值、重复坐标和高基数类别的数据按 `manual-acceptance.md` 核对业务语义。
3. 如配置真实 AI provider，只做一次受控验收，确认供应商支持 strict json_schema；日常回归继续使用 fake provider。

## 继续入口

- 人工步骤：`docs/manual-acceptance.md`
- 算法规范：`docs/charts.md`
- AI 合同：`docs/04_ai_integration.md`
- 测试命令：`docs/testing.md`
