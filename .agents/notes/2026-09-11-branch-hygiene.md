# 决策：分支卫生与依赖 PR 节奏（线性分支策略）

- 日期：2026-09-11
- 状态：已实施（清理 + 策略落地；三处待维护者定夺）
- 范围：远程分支、[`.github/dependabot.yml`](../../.github/dependabot.yml)、根 [AGENTS.md](../../AGENTS.md)

## 问题

1. 远程积压 12 个非 main 分支：9 个是 Dependabot 首次启用时一次冒出的 PR 分支，2 个是历史遗留（`refactor-plan`、`trae/agent-HFEMnl`）。
2. 多阶段治理期间没有成文的分支约定，容易被理解成"每个阶段开一个分支"，与项目实际做法（main 上小步提交）不一致。
3. 生产分组 PR 里混进了一个会让 CI 失败的依赖，按"分组一起合"处理会连带卡住其余 7 个更新。

## 决策

- **线性分支策略**：默认在 main 上小步提交（一件事一个 commit，可独立 revert）；实验性改造用本地分支或 worktree，完成后立刻删除，不把长期分支推到 origin。
- **分支清理判据**：`git rev-list --count main..origin/<branch>` 为 0（已完全被 main 包含）→ 直接删；大于 0 → 先看 diff 与最后更新时间，能证明被取代才删，无法判断价值就问维护者。
- **Dependabot 节奏**：npm 每周一按生产/开发两组提 PR（仅 minor+patch，并发 ≤5）；Actions 每月、并发 ≤3；框架与工具链 major（含 `@types/node`）不自动提；每个 PR 必须过 CI 的 verify + e2e 两个 job 才考虑合并。
- **本次清理结果**：删除 `refactor-plan`（相对 main 0 个未合并提交，tip 提交即"mark refactor-plan as merged into main"）；9 个 Dependabot 分支保留（对应 9 个待 review 的 PR）；`trae/agent-HFEMnl` 暂留待维护者判断。
- **分组不宜过大**：分组 PR 里只要有一个包不兼容就整组被卡。已知例：生产分组 #6 因 `monaco-editor` 0.56 改了 ESM 路径而 typecheck 失败（`Cannot find module 'monaco-editor/esm/vs/basic-languages/r/r.contribution.js'`），其余 7 个更新（`next` 16.3.4、`react`/`react-dom` 19.2.8、`pg`、`recharts`、`@base-ui/react`、`lucide-react`）在本 PR 里没有报错。

## 待维护者定夺（本轮不擅自处理）

1. `trae/agent-HFEMnl`：1 个未合并提交，内容是两份 Handoff 文档（`docs/handoff_refactor_2026-09-02.md`、`.uploads/…完整 Handoff.md`），对应 2026-09-02 的重构计划，而该计划在 main 上已落地（落后 98 个提交）。三选一：直接删 / 先归档进 `docs/archive/` 再删 / 保留。
2. 9 个 Dependabot PR：4 个 npm（生产分组 #6 失败、开发分组 #7 全绿、`openai` 7 与 `vitest` 5 为 major）+ 5 个 Actions major（checks 绿）；按策略 major 不自动合并，需人工判断。
3. 是否把 `monaco-editor` 从生产分组 `exclude-patterns` 排除（让它单独出 PR，其余 7 个更新可正常走），以及是否为 main 开启分支保护。

## 替代方案（强制）

- **每个阶段开一个长命分支**：单人项目 + CI 约 3 分钟，分支的隔离收益低于合并与同步成本；历史遗留分支（`refactor-plan`、`trae/agent-HFEMnl`）正是这么攒下来的。
- **Git Flow（develop / release / hotfix）**：没有并行发布与多角色协作，纯开销。
- **一次性 `git push --delete` 清掉全部 Dependabot 分支**：PR 会失去 head 分支，等于丢掉 9 个仍在评审队列里的更新信息，且 Dependabot 会重建。
- **把 major 也交给 Dependabot 自动合并**：本轮已验证 major 需人工判断（`vitest` 5、`openai` 7、Actions 大版本）；CI 只能证明"能编过"，不能证明"该升"。
- **本轮直接开 main 保护**：涉及仓库设置，按 handoff 边界只记待办、不自行开启。

## 影响与风险

- 收益：远程分支回到"main + 待 review 的 PR 分支"这一可解释状态；分支与提交约定成文，后续治理不再产生长命分支。
- 风险 1：分组 PR 被单个不兼容包卡住 → 用 `exclude-patterns` 拆出问题包（待维护者确认后改配置）。
- 风险 2：删除 `refactor-plan` 后，本地若仍有指向它的分支/worktree 会失效 → 用 `git branch -vv` 核对，必要时从 main 重拉。
- 未开启 main 保护：本地误操作可直推 main，当前靠纪律而非机制（已记入 AGENTS 待办）。

## 验证

- 清理前：`git rev-list --count main..origin/refactor-plan` = 0 且 `git merge-base --is-ancestor origin/refactor-plan main` 为真。
- 清理后：`git for-each-ref refs/remotes/origin` 只剩 main + 9 个 Dependabot 分支 + `trae/agent-HFEMnl`。
- PR 侧：`gh pr checks` 逐个核对——开发分组 #7 全绿；生产分组 #6 因 monaco 失败；其余 7 个 checks 绿但按策略属人工判断。
- 文档侧：链接校验与行尾校验通过（见提交信息）。

## 回滚

- 分支删除可恢复：`git push origin <sha>:refs/heads/refactor-plan`（该 tip 仍在 main 历史中）。
- 配置与文档：`git revert` 对应提交。

## 关联

- [2026-09-11-toolchain-governance.md](2026-09-11-toolchain-governance.md)（Node 基线、元库、CI 门禁、npm 纪律与 Dependabot 初版配置）
- [../../docs/operations.md](../../docs/operations.md)（依赖更新策略）
