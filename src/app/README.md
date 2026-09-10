# app/ — 页面与 Route Handler

- `page.tsx`：连接选择入口。
- `workspace/`：SQL 会话工作台，详见 [workspace/README.md](workspace/README.md)。
- `explorer/`：Schema 浏览与工作台入口，详见 [explorer/README.md](explorer/README.md)。
- `queries/`：收藏/历史查询与工作台入口，详见 [queries/README.md](queries/README.md)。
- `api/`：连接、Schema、查询和 AI Route Handler，详见 [api/README.md](api/README.md)。
- `fonts/`：自托管 Geist 字体资源（构建与开发不访问外部字体服务）。
- `globals.css`：唯一色源。语义 token 分三组——状态三件套（`--destructive/--success/--warning` 各带 surface/border）、图表专用 `--chart-*`（离散色板 / 顺序与发散色阶 / 网格刻度 / 缺失格）、结构类（`--background/--card/--border/--ring` 等）；新增颜色先加 token 再引用。
- 基础层惯例：全局 `border-border outline-ring/50`、`:focus-visible` 统一 outline、`prefers-reduced-motion` 归零动画；组件聚焦统一 `focus-visible:border-ring` + `ring-3 ring-ring/50`。
- 尺寸基调：控件默认 `h-8`，正文 `text-sm` / 次级 `text-xs` / 微级 `text-[10px]`（按钮组、徽标、状态条）；容器描边新式用 `ring-1 ring-foreground/10`，表单控件仍用 `border-input`。
- 改页面交互后必测：`scripts/offline_workspace_e2e.py`；改 API 后同步 mock 路由。
