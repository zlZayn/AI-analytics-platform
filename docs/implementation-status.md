# 实现状态与续作上下文

更新时间：2026-09-03

当前产品版本：`1.24.0`

## Git 状态

- 工作分支：`main`（重构 v4.5 已于 2026-09-02 合并；历史见 git log）
- 原始开发工作树位于 `.worktrees/`（已删除并存档）；Codex 可视化目录中的旧工作树由宿主环境管理，不是续作入口
- `.omo/` 与 `.codegraph/` 为本地工具产物，保持未跟踪

## 已完成（重构 v4 四阶段）

- 阶段一：会话/动作类型（`src/types/session.ts`、`actions.ts`）、`query-compiler`（参数化 SQL 防注入）、`validators`（双模式校验）、schema-service 数据轮廓扫描
- 阶段二：`useSession` + `sessionReducer`（19 Action）接入 workspace，API 传递 conversationHistory
- 阶段三：AI 双变体输出（querySpec + displayConfig 优先 / sql + chart 回退），数据轮廓注入提示词
- 阶段四：query-engine 返回 SemanticDataset（semanticType 全程透传）、`render-binder`（坐标翻转/无效值过滤）、`SessionView`、InsightCard 错误态
- 审核修复：数据轮廓排除平台元数据表；EXECUTE_SUCCESS 校验结果接入 UI

## 已完成（R 分析能力 P0/P1）

- P0：`r-bridge.ts`（SemanticDataset↔R 代码/CSV 纯函数）+ ResultToolbar（导出 CSV/JSON/复制 R 模板，中文列名 Excel 兼容）
- P1a：COI 头（COOP/COEP）+ webr@0.6.0 验证（`crossOriginIsolated=true`，`1+1=2`）
- P1b：`webr-client.ts`（SAB 通道、单例、purge 纪律、超时、规模阈值预留）+ mock 测试 + Monaco R 语言
- P1c/P1d：`RWorkbench` 组件树（内嵌区块、输出分级、快捷键、无障碍），SessionView 结果区下方接入
- P1 实测：R.wasm（12.3MB）从 CDN 按需加载；summary(df) 输出与 ggplot canvas 正常；关闭/重开包缓存保留

## 自动验证（2026-09-03，无环境变量离线）

```text
npm test                   25 files / 163 tests passed
npm run typecheck          passed
npm run lint               passed
npm run build              passed (Next.js 16.2.9)
scripts/check-links.py     0 errors
git diff --check           passed
CI 模拟（npm ci 全链路）   passed
浏览器 E2E（离线 mock）    passed；R 分析端到端（summary 输出 + 图）passed
```

浏览器烟测脚本（`scripts/final_ui_smoke.py`、`offline_workspace_e2e.py`）输出到 `.artifacts/`。开发服务器使用 `http://localhost:4321`，避免 Next.js 16 拒绝跨来源 HMR。

## 仍需人工完成

自动化不能替代以下外部验证，不属于遗留代码 TODO：

1. 真实只读 PostgreSQL 账号验证写拒绝、长查询取消、认证失效池清理、连接删除
2. 5,000+ 行、空值、重复坐标、高基数数据按 `manual-acceptance.md` 核对业务语义
3. 真实 AI provider 受控验收（strict json_schema 支持）
4. 轮换曾写入旧脚本/历史文档的 AI/API 与数据库凭据（Git 历史中的旧值视为泄露）

## 继续入口

- 人工验证：`docs/manual-acceptance.md`
- 架构决策：`docs/ARCHITECTURE.md`
- AI 合同：`docs/04_ai_integration.md`
- 测试命令：`docs/testing.md`