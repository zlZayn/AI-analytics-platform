# workspace/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- 路由只解析 `connection` 与 `sql`，业务执行由 `SessionWorkspace` 负责。
- 使用 Suspense 包裹 `useSearchParams` 页面，遵循 Next.js 16 App Router 约定。
