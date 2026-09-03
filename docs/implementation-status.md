# 实现状态与续作上下文

更新时间：2026-09-03（重构 v4.5 已合并 main）

当前产品版本：`1.24.0`

## Git 状态

- 工作分支：`main`（重构 v4.5 已合并，见 [AGENTS.md](../AGENTS.md) 待办）
- 重构方案：[docs/REFACTOR_PLAN_v4.md](REFACTOR_PLAN_v4.md) · 进度追踪：[REFACTOR_STATUS.md](../REFACTOR_STATUS.md)
- 前一阶段收尾：`34a9651`（workbench refactor 合并）+ `b5aa748`（query lifecycle）+ `9779185`（收尾硬化）
- 原始开发工作树位于 `.worktrees/`（已删除并存档）；Codex 可视化目录中的旧工作树由宿主环境管理，不是续作入口
- `.omo/` 与 `.codegraph/` 为本地工具产物，保持未跟踪

## 已完成（重构 v4 四阶段）

- 阶段一：会话/动作类型（`src/types/session.ts`、`actions.ts`）、`query-compiler`（参数化 SQL 防注入）、`validators`（双模式校验）、schema-service 数据轮廓扫描
- 阶段二：`useSession` + `sessionReducer`（19 Action）接入 workspace，API 传递 conversationHistory
- 阶段三：AI 双变体输出（querySpec + displayConfig 优先 / sql + chart 回退），数据轮廓注入提示词
- 阶段四：query-engine 返回 SemanticDataset（semanticType 全程透传）、`render-binder`（坐标翻转/无效值过滤）、`SessionView`、InsightCard 错误态
- 审核修复：数据轮廓排除平台元数据表；EXECUTE_SUCCESS 校验结果接入 UI

## 自动验证（2026-09-03，无环境变量离线）

```text
npm test                   25 files / 111 tests passed
npm run typecheck          passed
npm run lint               passed
npm run build              passed (Next.js 16.2.9)
scripts/check-links.py     0 errors
git diff --check           passed
CI 模拟（npm ci 全链路）   passed
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