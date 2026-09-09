# app/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

- 页面遵循 Next.js 16 App Router；交互页面显式使用 Client Component。
- Route Handler 返回统一 `ApiResponse<T>`，不在页面绕过客户端 API 适配层。
- 页面职责与路由见 [README.md](README.md)。
