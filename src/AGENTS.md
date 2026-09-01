# src/ — 规则层

继承根规则，见 [../AGENTS.md](../AGENTS.md)。

src/ 特有约束：
- Next.js 16 有破坏性变更：新代码先读 `node_modules/next/dist/docs/` 对应指南（见 [根 AGENTS.md](../AGENTS.md)）
- 测试用 vitest，与被测模块同目录的 `__tests__/`；改模块必跑对应测试（清单见 [README.md](README.md)）
- API Route Handler 必须返回统一 `ApiResponse<T>`（见 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)）
- 图表颜色只用 `app/globals.css` 语义 token，不建第二套颜色常量（见 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)）
- 不写"有什么文件/怎么改"，那是 [README.md](README.md) 的职责