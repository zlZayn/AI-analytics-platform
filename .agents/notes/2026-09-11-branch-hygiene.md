# 决策：分支卫生与依赖 PR 节奏（线性分支策略）

- 日期：2026-09-11
- 状态：已实施（清理与策略落地；4 个 Actions PR 待授权后合并）
- 范围：远程分支、[`.github/dependabot.yml`](../../.github/dependabot.yml)、main ruleset、根 [AGENTS.md](../../AGENTS.md)、[docs/operations.md](../../docs/operations.md)

## 问题

1. 远程积压 12 个非 main 分支：9 个是 Dependabot 首次启用时一次冒出的 PR 分支，2 个是历史遗留（`refactor-plan`、`trae/agent-HFEMnl`）。
2. 多阶段治理期间没有成文的分支约定，容易被理解成"每个阶段开一个分支"，与项目实际做法（当前分支小步提交）不一致。
3. 生产分组 PR 里混进了一个会让 CI 失败的依赖，按"分组一起合"处理会连带卡住其余 7 个更新。
4. main 此前无任何保护，本地误操作可直推。

## 决策

- **main 受 ruleset 保护**：必须走 PR、必需检查 `Lint · Typecheck · Test · Build · Docs` 与 `Offline E2E (browser)`、禁止删除与强推、允许 squash/merge 两种合并方式、无需人工 approve（`required_approving_review_count: 0`）。ruleset 由 `gh api` 维护（id 见"验证"节），不用网页手工配置。
- **短命分支 + 线性历史**：改动在临时分支上线性推进（每步一个独立 commit），squash 合并后删除分支；**阶段治理＝在当前分支连续提交，不新建长命分支**。本地实验用分支或 worktree，完成后删除，不推长期分支到 origin。
- **分支清理判据**：`git rev-list --count main..<branch>` 为 0（已完全被 main 包含）且最后更新 > 30 天 → 可删；不满足则先看 diff 与时间，能证明被取代才删，无法判断价值就问维护者。
- **Dependabot 节奏**：npm 每周一按生产/开发两组提 PR（仅 minor+patch，并发 ≤5）；Actions 每月、并发 ≤3；框架与工具链 major（`next`/`react`/`prisma*`/`tailwindcss`/`typescript`/`eslint`/`vitest`/`openai`）与 `@types/node` major 不自动提；生产分组用 `exclude-patterns` 排除 `monaco-editor`（0.56 改了 ESM 路径，混组会让整组 typecheck 失败）。
- **合并通道的已知限制**：经 API 合并"改动 `.github/workflows/`"的 PR 需要 `gh` token 具备 `workflow` scope；没有该 scope 时只能网页端合并（本轮 #2–#5 即卡在这里）。

## 处置结果（2026-09-11）

- 历史分支：删除 `refactor-plan`（0 未合并提交）与 `trae/agent-HFEMnl`（仅两份 Handoff 文档、落后 main 98 个提交、无代码，计划已在 main 落地）。
- 已合并：PR #7（开发分组 3 个更新）、PR #1（`actions/checkout` 4→7）；Dependabot 已自动删除对应分支。
- 已关闭：PR #9（`openai` 6→7 major）、PR #10（`vitest` 4→5 major）、PR #6（生产分组：`monaco-editor` 0.56 使 typecheck 失败）；三者分支已清空，前两者的 major 已加入 ignore、`monaco-editor` 已从分组排除，因此不会原样重开。
- 待授权合并：PR #2–#5（`upload-artifact`/`setup-node`/`cache`/`setup-python` 的 major，checks 全绿）——需要 `gh auth refresh -s workflow` 或在网页端合并。
- **配置生效后的 Dependabot 复跑（同日）**：新出 PR #12 生产分组（8 个更新，**不含 `monaco-editor`**，verify 绿）、#13 开发分组补丁、#14 `monaco-editor` 单独 PR（verify 失败，不兼容被隔离成单包信号）、#15 `jsdom` 30 major（非分组，属人工判断范围）——"拆组"达到预期：一组不再被单包连坐，major 仍以 PR 形式可见但不自动合。

## 替代方案（强制）

- **每个阶段开一个长命分支**：单人项目 + CI 约 3 分钟，分支隔离收益低于合并与同步成本；历史遗留分支正是这么攒下来的。
- **继续无保护直推 main**：本地误操作无兜底；本轮已用 ruleset 收口，且 ruleset 走 `gh api` 而不用网页手配，避免配置与实际检查名漂移。
- **Git Flow（develop / release / hotfix）**：没有并行发布与多角色协作，纯开销。
- **一次性 `git push --delete` 清掉全部 Dependabot 分支**：PR 失去 head 分支等于丢掉评审队列里的信息，且 Dependabot 会重建。
- **major 交给 Dependabot 自动合**：`vitest` 5、`openai` 7、Actions 大版本都需要人工判断；CI 只能证明"能编过"。
- **把 `monaco-editor` 直接 ignore 掉**：会同时丢掉它的小版本修复；改用 `exclude-patterns` 让它单独出 PR，升级信息不丢。

## 影响与风险

- 收益：远程分支回到"main + 待合并 PR"的可解释状态；分支、提交与合并通道成文；main 有机器兜底。
- 风险 1：ruleset 的必需检查名必须与 workflow 的 job 名逐字一致（本轮踩过：写成 `verify`/`e2e` 时所有 PR 永久 BLOCKED）→ 改 job 名或 ruleset 时必须同步。
- 风险 2：token 缺 `workflow` scope 时，改动 CI 的 PR 无法经 API 合并 → 需补 scope 或网页合并。
- 风险 3：生产分组即使排除 `monaco-editor`，其余包仍可能单独不兼容 → 单包失败时按同样方式拆组，不整组合并。

## 验证

- 清理前：`git rev-list --count main..origin/refactor-plan` = 0 且 `git merge-base --is-ancestor` 为真；`trae/agent-HFEMnl` 的 diff 只有两份 markdown。
- ruleset：`gh api repos/zlZayn/AI-analytics-platform/rulesets --jq '.[] | "\(.id) \(.name) \(.enforcement)"'` → `22918503 main-branch-protection active`；`gh pr view 7 --json mergeStateStatus` 由 `BLOCKED` 变 `CLEAN`。
- 合并后（2026-09-11 快照）：`git for-each-ref refs/remotes/origin` = `main` + 4 个待合并 Actions 分支 + Dependabot 复跑新开的 PR 分支；长期口径是"`main` + 待合并 PR 分支"，具体清单不入文档。
- 文档侧：链接校验与行尾校验通过（见提交信息）。

## 回滚

- 分支删除可恢复：`git push origin <sha>:refs/heads/<branch>`（被删分支的 tip 仍在 main 历史或 PR 记录里）。
- ruleset 可整体回退：`gh api repos/zlZayn/AI-analytics-platform/rulesets/22918503 -X DELETE`。
- 配置与文档：`git revert` 对应提交。

## 关联

- [2026-09-11-toolchain-governance.md](2026-09-11-toolchain-governance.md)（Node 基线、元库、CI 门禁、npm 纪律与 Dependabot 初版配置）
- [../../docs/operations.md](../../docs/operations.md)（依赖更新策略与合并通道）
