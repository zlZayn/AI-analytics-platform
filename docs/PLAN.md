# 进行中计划（跨会话延续）

更新时间：2026-09-11
当前产品版本：`1.32.6`

用途：WIP 手账，跨会话延续上下文。验证数字、待办与活跃坑见 [../AGENTS.md](../AGENTS.md)；阶段成果与"为什么这样设计"见 [.agents/notes/](../.agents/notes/) 决策记录，不重复列出。

## 未完成事项

### 已知界面缺口（2026-09-11 复核）

- 探索页表预览硬编码 `schema: "public"` 且无分页（`src/app/explorer/page.tsx`）。
- 查询管理页行内操作按钮仅 hover 可见（`opacity-0 group-hover:opacity-100`），触屏不可达。
- 查询结果截断（`SemanticDataset.truncated` / `rowLimit`）与 `needs_recompile` 状态在界面上无呈现。

### 人工验收

- 真实只读 PostgreSQL 账号验证写拒绝 / 长查询取消 / 认证失效池清理 / 连接删除，见 [verification.md](verification.md)
- 5,000+ 行、空值、重复坐标、高基数数据集按 [verification.md](verification.md) 的人工验收清单核对业务语义
- 真实 AI provider 验收：strict json_schema 对 `context`/`statTest` 字段的输出符合性
- 联网验收 R 历史回放：重开面板 `df` 与当前结果集一致、注入期间状态栏显示 `injecting`（图像输出已于 2026-09-11 浏览器确认），见 [verification.md](verification.md)
- 轮换曾写入旧脚本或历史文档的 AI/API 与数据库凭据（Git 历史中的旧值视为泄露）

### 可选增强

- R.wasm Service Worker 预加载 / requestIdleCallback 预热（当前按需加载）
- statTest 黑盒统计的真实 R 浏览器端实测（离线 E2E 只验证了错误路径，成功路径需联网）
- 统一图表高度契约：探索图表填满剩余高度（图表视图当前固定 320px），见 [决策记录](../.agents/notes/2026-09-11-detail-table-single-owner.md)

## 已拍板决策

蓝图阶段 1-4 已完成（结果区三层 Tabs / 多洞察+业务上下文 / WebR 黑盒统计 / 体验打磨），过程记录见 [.agents/notes/](../.agents/notes/)。

- 结果区三层 Tabs（洞察 / 探索 / 明细）：阶段 1 已实施，见 [决策记录](../.agents/notes/2026-09-03-result-area-three-layer-tabs.md)
- 数据表单一 owner：`table` 退出探索的图表类型，明细独占数据表，见 [决策记录](../.agents/notes/2026-09-11-detail-table-single-owner.md)
- WebR 黑盒统计引擎（固定模板，替代 AI 直接生成 R）：阶段 3 已实施，见 [决策记录](../.agents/notes/2026-09-03-webr-blackbox-stat-engine.md)

## 相关文档

- 验证快照/待办/活跃坑 [AGENTS.md](../AGENTS.md) · 设计决策 [ARCHITECTURE.md](ARCHITECTURE.md) · 维护清单 [maintenance-checklist.md](maintenance-checklist.md) · 人工验收 [verification.md](verification.md)

## Git 状态

- 工作分支：`main`（重构 v4.5 已于 2026-09-02 合并；历史见 git log）
- 原始开发工作树位于 `.worktrees/`（已删除并存档）
- `.omo/` 与 `.codegraph/` 为本地工具产物，保持未跟踪

## 下一步

1. 真实只读账号完成人工验收
2. 联网环境实测 statTest 成功路径与 InsightCard 统计区块
3. 按需实施可选增强项（R.wasm 预加载、统一图表高度契约）
