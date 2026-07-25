# 实现状态与续作上下文

更新时间：2026-07-25

## Git 状态

- 当前分支：`main`
- 合并提交：`34a9651 merge: complete analytics workbench refactor`
- 功能提交：`b5aa748 feat: complete query lifecycle and API contracts`、`49b1477 feat: complete chart pipeline and offline AI contracts`
- 收尾实现提交：`9779185 chore: finalize workbench hardening`
- 原开发工作树：`E:\新下载\ai-data-analytics\.worktrees\complete-analytics-refactor`（最终验证后已删除并 prune）
- Codex 可视化目录中的旧 `analytics-workbench-refactor` 工作树由宿主环境管理，不是当前续作入口；所有有效状态和文档以本项目目录及 `main` 为准。
- 合并功能分支时原有 `package-lock.json` 未被覆盖；最终收尾只把纯类型包 `@types/pg` 从运行时依赖归入开发依赖并同步 lockfile。`.omo/` 保持未跟踪且未修改。

### 收尾验证说明

- 合并后首次执行 `npm run lint` 时，ESLint 进入原开发工作树的 `.next` 生成目录并超时；这不是源码错误。
- `eslint.config.mjs` 已统一忽略任意层级的 `**/.next/**` 和仓库本地 `.worktrees/**`，避免隔离工作树污染主工作区质量门禁。
- 本节中的验证状态只以 `main` 上重新执行的完整命令为准；命令、结果与人工验收入口见下文。

## 已完成

- 查询：单条 SELECT/WITH、PostgreSQL 只读事务、数据库 statement timeout、真实 `pg_cancel_backend` 取消、5,000 行硬上限和安全失败历史。
- 连接：有限 PoolRegistry、并发创建去重、闲置/LRU 回收、更新/删除/认证错误失效；Schema active 快照事务切换和部分唯一索引迁移。
- API：所有 Route Handler 使用统一 `ApiResponse<T>`；客户端统一处理 HTTP、非 JSON、超时、Abort 和 requestId。
- 探索预览：新增 `/api/query/preview`，客户端只传 connectionId/schema/table，服务端引用标识符并复用查询引擎，限制 100 行。
- 图表合同：`ChartMapping` 改为无字符串兜底、无索引签名的判别联合；算法、变换、Worker 和视图解耦，删除重复统计实现。
- 图表算法：Type 7 箱线、FD/Sturges 直方、Pearson/Spearman/Kendall tau-b、成对删除及每格 n；相关矩阵在可取消 Worker 中计算。
- 显示边界：折线时间排序/空值断线/重复坐标错误；柱状显式分组/堆叠/百分比；散点严格过滤和 2,000 点确定性分层抽样；饼图非负校验和前 8 类“其他”；热力图缺失/零分离、重复检测及顺序/发散色阶。
- 使用体验：点击图表后按完整画像填入合法默认映射；结果表窗口化、粘性表头、NULL 标记、列宽持久化和键盘滚动；Error Boundary 自动重置、手动重试和安全文案；最新请求身份保护。
- AI：领域中立提示词、当前 Schema 注入、供应商原生 strict JSON Schema、运行时 SQL/图表/槽位/输出别名校验、可注入 provider；真实 provider 的 Base/Key/Model 均须显式配置，测试不调用真实 API。
- 凭据治理：删除根目录旧真实 AI 手工脚本；种子数据库只接受独立 `SEED_DATABASE_URL`；移除固定加密密钥回退并要求至少 32 字符；新密文使用每条随机盐且兼容旧三段格式；仓库提供默认留空、失败关闭的 `.env.example`。
- 视觉：产品只保留集中 token 管理的专业亮色；移动导航、四视口布局和自绘矩阵居中已检查。
- 文档：README、设计哲学、API、AI、模块、图表、测试、运维、页面结构和人工验收已同步，旧 EXPLAIN/文本 SQL/8 图表说明已删除。

## 自动验证

最终提交前的最近结果：

```text
npm test                         20 files / 59 tests passed
npm run typecheck                passed
npm run lint                     passed
npm run build                    passed (Next.js 16.2.9)
git diff --check                 passed
python scripts/final_ui_smoke.py passed at 360/768/1280/1440
python scripts/offline_workspace_e2e.py passed; all 10 views selected
```

烟测截图输出到 Git 忽略的 `.artifacts/`。开发服务器使用 `http://localhost:4321`，避免 Next.js 16 拒绝跨来源 HMR；两支脚本均可通过 `BASE_URL` 覆盖地址。本机平台数据库密码无效时，`/api/connections` 会返回安全 500；烟测仅把“该已知离线响应且错误状态可见”视为允许，其他 HTTP/页面/控制台错误仍失败。

## 仍需人工完成

自动化不能替代以下外部验证，不属于遗留代码 TODO：

1. 使用真实只读 PostgreSQL 账号验证写语句被数据库拒绝、长查询取消、认证失效池清理和连接删除。
2. 使用包含 5,000+ 行、空值、重复坐标和高基数类别的数据按 `manual-acceptance.md` 核对业务语义。
3. 如配置真实 AI provider，只做一次受控验收，确认供应商支持 strict json_schema；日常回归继续使用 fake provider。
4. 轮换曾写入旧脚本和历史文档的 AI/API 与数据库凭据；当前代码已清除，但 Git 历史中的旧值仍应视为泄露。

## 继续入口

- 人工步骤：`docs/manual-acceptance.md`
- 算法规范：`docs/charts.md`
- AI 合同：`docs/04_ai_integration.md`
- 测试命令：`docs/testing.md`
