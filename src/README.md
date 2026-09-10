# src/ — 源码手册

- 职责：Next.js 16 App Router 应用源码（页面、API Route Handlers、组件、核心库）
- 测试与被测模块同目录的 `__tests__/`（每个目录自带 `README.md` 覆盖范围与 `AGENTS.md` 写法约束），无独立 `tests/` 目录

## 测试

- 命名：`x.ts` → `x.test.ts(x)`，与源文件同名便于定位；目录集合即 `src/**/__tests__/`，不要另开 `tests/`。
- 约定、分类与 CI → [docs/testing.md](../docs/testing.md)；任何改动后跑 `npm test`，数字更新到根 [AGENTS.md](../AGENTS.md) 验证快照。

## 目录职责

- `app/`：页面与 API，详见 [app/README.md](app/README.md)
- `components/`：布局、工作台、结果和基础组件，详见 [components/README.md](components/README.md)
- `hooks/`：会话与交互状态，详见 [hooks/README.md](hooks/README.md)
- `lib/`：核心库与边界适配，详见 [lib/README.md](lib/README.md)
- `types/`：跨层类型契约，详见 [types/README.md](types/README.md)
- `generated/prisma/`：Prisma 生成客户端，可再生，不手改
- 编辑器：Monaco 从 npm 包本地加载（`monaco-setup.ts` 的 `loader.config`），不访问 CDN，离线可用

## 页面路由

| 路由 | 功能 |
| :--- | :--- |
| `/` | 连接选择与管理 (侧边栏下拉切换) |
| `/workspace?connection=xxx` | 数据工作台 (SQL 编辑 + AI 助手 + @ 选表) |
| `/explorer?connection=xxx` | 数据探索 (Schema 浏览) |
| `/queries?connection=xxx` | 查询管理 (收藏 + 历史) |

## 改动路由

- 核心库与测试 → [lib/README.md](lib/README.md)
- 会话与交互状态 → [hooks/README.md](hooks/README.md)
- 组件与结果视图 → [components/README.md](components/README.md)
- 页面与 API → [app/README.md](app/README.md)
- 任何模块改动 → 跑 `npm test`，数字更新到根 [AGENTS.md](../AGENTS.md) 验证快照

## 引用

- 工作约束与偏好 → [AGENTS.md](AGENTS.md)
- 设计决策与防错清单 → [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
