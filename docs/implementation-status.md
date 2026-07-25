# 实现状态与续作上下文

更新时间：2026-07-25

## 当前分支

- 当前主分支：`main`
- 合并提交：`fa96687 merge: analytics workbench refactor`
- 功能提交：`2cbea30 feat: harden analytics workbench and chart pipeline`
- 原实现曾在 Codex 隔离 worktree 完成，现已合并回项目目录 `E:\新下载\ai-data-analytics`
- 未跟踪的 `.omo/` 是主项目原有工作区文件，本次未修改

## 本次已完成

- 查询执行使用 PostgreSQL 只读事务、数据库 `statement_timeout` 和 5,000 行返回上限；响应增加 `truncated`、`rowLimit` 等元数据。
- 连接更新/删除时清理连接池；Schema 刷新归档旧 active 快照；连接测试失败保证关闭临时 Pool。
- 新增统一客户端请求封装，处理 HTTP 错误、非 JSON 响应、超时和 Abort；工作台、探索页、查询管理页和连接管理页已接入主要请求路径。
- AI client 改为懒加载，未配置 `AI_API_KEY` 不会阻断生产构建；AI 输出增加运行时图表类型和字段结构校验。
- 新增数据画像、图表推荐、字段映射校验、Type 7 箱线统计、Freedman-Diaconis/Sturges 直方图、常量列相关性保护和 Kendall tau-b 实现。
- 新增 KPI 与直方图图表，相关矩阵和箱线图接入新算法；图表色板改为语义 token 并支持深色主题。
- 工作台、探索页和侧栏增加窄屏布局；增加移动导航抽屉、主题切换和错误/重试状态。
- 新增设计哲学、图表算法、API、测试和运维文档。
- 新增 Vitest 测试入口与 13 个测试。

## 已验证

在隔离 worktree 执行通过：

```text
npm test          4 files / 13 tests passed
npm run typecheck passed
npm run lint      passed
npm run build     passed
```

移动端烟测验证了 390x844 导航抽屉、页面渲染和数据库连接失败提示。生产服务使用临时端口 4318，已停止。

2026-07-25 在合并后的 `main` 再次完成：

```text
npm test          4 files / 13 tests passed
npm run typecheck passed
npm run lint      passed（0 errors / 0 warnings）
npm run build     passed（Next.js 16.2.9）
```

项目内 `scripts/final_ui_smoke.py` 已在生产服务上覆盖 360、768、1280、1440 四种宽度，验证亮暗主题、移动导航抽屉、页面横向溢出和浏览器 Console。测试通过，临时服务已停止；截图输出到 Git 忽略的 `.artifacts/ui-smoke/`。真实数据库、查询取消、完整图表语义与键盘路径仍须按 `docs/manual-acceptance.md` 人工验收。

## 尚未完成的技术债务

1. 服务器端尚未把 Request disconnect 绑定到 PostgreSQL 主动 cancel，目前依靠数据库 statement timeout。
2. 仍有部分 API 路由使用旧的 `{ success, error: string }` 结构，需统一迁移到 `api-response.ts` 的错误合同。
3. `ChartMapping` 还保留旧索引签名，`utils.ts` 中仍有未删除的旧箱线/相关性实现，需合并到 `algorithms.ts` 后删除重复代码。
4. 散点确定性采样、饼图“其他”合并、热力图缺失单元格编码和相关矩阵 Web Worker 尚未完成。
5. 结果表尚未做虚拟化、列宽持久化和完整键盘表格交互。
6. Schema active 唯一约束和历史清理迁移尚未生成。
7. 还缺少真实 PostgreSQL 集成测试、API 路由测试、Playwright 完整业务流程测试和多图表亮暗主题视觉回归。
8. AI 提示词已移除药店业务假设，但 JSON Schema 尚未升级为供应商原生 structured output。

## 下一次建议顺序

1. 先补 PostgreSQL 查询取消、连接池和 Schema 快照的集成测试。
2. 清理重复图表算法与宽泛 `ChartMapping` 类型，固定统一数据合同。
3. 完成结果表虚拟化、散点/饼图显示边界和热力图缺失值视觉编码。
4. 加入 Playwright 桌面/移动/亮暗主题回归及 API 错误竞态测试。
5. 最后生成 Prisma migration，更新 README/API 文档，再决定合并或创建 PR。

## 人工验收入口

- 完整步骤：`docs/manual-acceptance.md`
- 自动布局烟测：`python scripts/final_ui_smoke.py`（需先在 4321 端口启动生产服务）

## 继续开发命令

```powershell
Set-Location 'E:\新下载\ai-data-analytics'
npm test
npm run typecheck
npm run lint
npm run build
```

后续开发请从 `main` 创建新的 `codex/...` 分支；不要直接把未验证的改动提交到 `main`。
