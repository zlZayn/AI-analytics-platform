# 测试约定

## 本地验证

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma generate   # 若 src/generated/prisma 不存在
git diff --check
```

## 布局与索引

- 测试与被测模块同目录的 `__tests__/`（`vitest.config.ts` include 为 `src/**/*.test.ts(x)`），无独立 `tests/` 目录。
- 命名：测试文件与被测模块同名（`x.ts` → `x.test.ts(x)`），从源文件即可定位测试。
- 每个 `__tests__/` 目录自带两份说明：`AGENTS.md`（该目录的写法约束）、`README.md`（覆盖范围与运行方式）；引用一律指向目录 README，不在此处复制文件清单。
- 新增或移动测试必须同步所在目录 README 的覆盖范围；目录集合即 `src/**/__tests__/`。

## 测试分类

- Vitest + jsdom：纯算法、请求封装、会话状态、组件合同（jsdom + `createRoot`）。
- Playwright 脚本：浏览器布局与端到端（`scripts/`，CI 不跑，需本地 chromium）。
- 算法测试必须覆盖空值、非有限值、常量列、并列值、重复坐标、极端值和大数据边界。
- 全局契约：主题由亮色契约测试守卫（防暗色分支回流）；AI 测试一律注入 fake provider，禁止真实 API；启动脚本与版本 bump 各有契约测试——分类清单见 [lib/__tests__/README.md](../src/lib/__tests__/README.md)。
- R 工作台：纯函数与状态机在 vitest 跑；真实 R 执行依赖 CDN 与浏览器，CI 不跑，按 [manual-acceptance.md](manual-acceptance.md) 人工验证。

关键回归场景：查询超时与真实取消、5,000 行截断、连接池失效、Schema 唯一快照、非 JSON API 错误、请求竞态、图表算法、窗口化表格、AI 结构化输出与降级、亮色一致性、窄屏布局。

## CI（GitHub Actions）

`.github/workflows/ci.yml` 在每次推送与 PR 上执行：install（`npm ci`）→ prisma generate → typecheck → lint → test → build → 文档链接校验（`scripts/check-links.py`）→ diff 检查。build 步骤注入占位 `ENCRYPTION_KEY`/`DATABASE_URL`（模块加载时校验密钥）。浏览器脚本不在 CI 跑。

## 浏览器脚本

先在 4321 端口启动应用，再运行 `scripts/` 下的验收脚本；用法、视口与输出目录见 [scripts/README.md](../scripts/README.md)。开发服务器运行离线 E2E 时用 `BASE_URL=http://localhost:4321`，生产服务器用默认地址。

## 文档导航

- 被测模块与改动路由 [src/README.md](../src/README.md) · 人工验收 [manual-acceptance.md](manual-acceptance.md) · 设计决策 [ARCHITECTURE.md](ARCHITECTURE.md) · AI 契约 [04_ai_integration.md](04_ai_integration.md)
