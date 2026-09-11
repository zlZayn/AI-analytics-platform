# 决策：工具链与依赖治理（Node 基线、元库可重建、回归守卫、npm 纪律）

- 日期：2026-09-11
- 状态：已实施（阶段式落地，每阶段一个提交）
- 范围：`.node-version`/`.nvmrc`/`package.json`/`package-lock.json`、`.github/workflows/ci.yml`、`.github/dependabot.yml`、`prisma/bootstrap.sql`、`scripts/db-init.mjs`、`scripts/check-db-drift.mjs`、`scripts/requirements.txt`、README 双语、[docs/operations.md](../../docs/operations.md)、[docs/verification.md](../../docs/verification.md)、[docs/maintenance-checklist.md](../../docs/maintenance-checklist.md)

## 问题

1. 元库无法从零重建：12 个 Prisma 模型只有 2 个补丁 SQL，没有基表创建脚本；README 让新环境跑 `npx prisma migrate deploy`，而该命令缺 `migration_lock.toml` 必然失败，且与"禁止 migrate / db push"政策冲突（本地库是早期 `db push` 遗留，所以看不出这个洞）。
2. 运行时版本漂移：本机 Node 24 / CI 22 / README 徽章 22 / `@types/node` 20，四处不一致。
3. 浏览器面回归只靠手工：Monaco、R 面板、统一历史时间线、分割句柄、移动端这些最容易回归的交互没有机器守卫，浏览器脚本的 Python 依赖也没声明。
4. 依赖边界错位：源码直接 import 的 `monaco-editor` 未声明（只靠 peer 自动装入）；`prisma`、`shadcn` 两个 CLI 放在 `dependencies`；`@vitest/coverage-v8` 声明但从未被任何配置或命令使用。
5. 安装脚本行为两边不一致：本地 npm 12 默认拦截依赖 pre/postinstall，CI 的 npm 10 会执行，且没有任何声明说明以哪边为准。

## 决策

- **Node 基线 22，单一来源**：`.node-version`（另加 `.nvmrc`）写 22，CI 用 `node-version-file` 读同一文件，`engines.node` = `>=22 <25`，`@types/node` 对齐 ^22；本机 24 落在允许区间内但不作为验收基准。
- **元库 = 幂等基线 + 增量补丁 + 只读漂移检查**：`prisma/bootstrap.sql` 承载 12 张表的全量基线（全部 `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`，含固定属主 `default-user`），`prisma/migrations/` 继续只放增量；`npm run db:init` 在事务内整份应用（可重复执行、失败回滚），`npm run db:check` 只读比对 `schema.prisma` 与库中表/列、漂移时退出码 1；README 的初始化路径改为 `npm run db:init`。
- **回归守卫分两层**：本地 `npm run verify`（typecheck + lint + test，与 CI 同口径）；CI 增 `e2e` job 跑离线浏览器 E2E（全程 mock API、主动 abort WebR CDN，不需要数据库/密钥/外网），Playwright 版本锁在 `scripts/requirements.txt`，失败上传截图与服务端日志。
- **包管理保持 npm + 单一 `package-lock.json`**：不迁移；改为强化纪律——`monaco-editor` 显式声明、CLI/脚手架进 devDependencies、删掉未使用的覆盖率依赖、CI 两个 job 统一 `npm ci --ignore-scripts`（与本地 npm 12 的默认拦截一致，已验证构建/测试/运行都成立）。
- **更新策略落地为配置**：`.github/dependabot.yml` 每周一按生产/开发两组提 minor+patch PR（CI 全绿才合并）；Next/React/Prisma/Tailwind/TypeScript/ESLint 与 `@types/node` 的 major 不自动提（`@types/node` 必须跟随 Node 基线）；Actions 每月一次、同时最多 3 个 PR。
  首次启用即产生 10 个 PR（5 个 npm + 5 个 Actions major 积压），说明配置生效；major 是否合并由维护者逐个人工判断，不自动合。

## 替代方案（强制）

- **迁移到 pnpm / yarn**：单包仓库，`npm ci` 已可复现；收益只有安装速度与磁盘，代价是严格 node_modules 下 peer 依赖（`monaco-editor`）与四个原生/postinstall 传递依赖（`esbuild`、`sharp`、`@prisma/engines`、`unrs-resolver`）都要重新配置并重验，属于为换工具而换工具。
- **上 Turborepo / Nx 编排**：没有多包与跨包任务图，唯一重活是 `next build`，编排层零收益。
- **用 `prisma migrate` / `db push` 管理元库**：元库与业务表同库会 DROP `fact_*`/`dim_*`，且要对现状做 baseline，风险与收益不匹配。
- **用 `pg_dump` 当基线**：与 `schema.prisma` 形成双源、易过期，dump 还可能夹带本地数据与密钥。
- **用 `allowScripts` 白名单代替 `--ignore-scripts`**：npm 12 的 `install-scripts approve` 会写**版本钉死**的审批项（Prisma 一升级即失效），而 npm 10 的 CI 根本不读这个字段，两边仍不一致。
- **只把 E2E 留在本地**：这些交互正是已经发生过回归的地方；CI 里的离线 E2E 不需要数据库与外网，成本只有 1–2 分钟。
- **保留 `@vitest/coverage-v8`**：没有任何覆盖率配置引用它；将来要做覆盖率，`npm i -D @vitest/coverage-v8` 一条命令即可回来。

## 影响与风险

- 收益：新环境可按 README 从空库初始化并跑通全栈；结构漂移可检测；本地/CI 的版本与安装行为一致；浏览器面回归有机器守卫；依赖边界与更新节奏写在配置里而不是口头约定。
- 风险 1：`bootstrap.sql` 可能与 `schema.prisma` 再次漂移 → 由 `npm run db:check` 兜底（本地与上线前跑；CI 无数据库不跑）。
- 风险 2：`npm ci --ignore-scripts` 会跳过将来某依赖真正需要的 postinstall → CI 会响亮失败，届时按 [operations.md](../../docs/operations.md) 的纪律单独评估放开方式。
- 风险 3：基线锁 22，本机 24 与 CI 22 仍可能有行为差异 → 以 CI 为准；升基线只改 `.node-version` 一处并同步 `engines` 与徽章。
- 生产部署形态仍未确认（进程管理、反向代理与 COI 头、服务器 Node 版本、元库备份），本轮不修改部署流程，只在 [operations.md](../../docs/operations.md) 标注待确认。

## 验证

- 阶段 1：`npm test`（50 files / 288 passed）、`typecheck`、`lint`、`build` 全绿；CI 在 Node 22 上复跑成功。
- 阶段 2：空库（临时库 `ai_analytics_bootstrap_check`）`db:init` 建出 12 张表 + 35 个索引、`db:check` 无漂移；用该库启动应用跑通 `POST /api/connections` → `POST /api/query`（dim_date 5 行）→ `POST/GET /api/history` 与 `/api/query/history`；现有库连跑两次 `db:init`，第二次为"无新建"且行数前后一致（connections 1 / query_history 377 / analysis_history 0 / users 1）；临时库与临时 env 文件已删除。
- 阶段 3：本地 `npm run verify` 全绿、离线 E2E 通过；CI `e2e` job 成功。
- 阶段 5：`npm ci --ignore-scripts` 全量重装 878 包 → `prisma generate` → `verify` → `build` → 离线 E2E 全绿；锁文件 diff 仅限本次意图（新增 `monaco-editor` 声明、`shadcn` 4.11→4.21、移除 coverage 相关 20 个包）。

## 回滚

- 每阶段一个提交，`git revert <sha>` 可独立回滚；依赖类改动回滚后 `npm ci` 恢复原依赖树。
- 元库侧：`db:init` 在现有库只补建了 `schema_snapshots_one_active_per_connection` 索引（无数据改动）；如需撤销：`DROP INDEX schema_snapshots_one_active_per_connection`。

## 关联

- [2026-09-03-windows-script-encoding-rules.md](2026-09-03-windows-script-encoding-rules.md)（`.cmd` 编码约束，本轮沿用）
- [2026-09-11-history-persistence-and-r-replay-rerun.md](2026-09-11-history-persistence-and-r-replay-rerun.md)（元库新增 `analysis_history` 表，本轮的基线据此补齐）
