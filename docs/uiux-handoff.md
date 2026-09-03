# UIUX 现状交接文档（临时）

> 定位：一次性收集产物，用于「UIUX 方案 A（结果区 Tabs 化）」拍板与实施交接。
> 本文件无任何长期文档引用，可随时删除，删除不影响文档网络。
> 来源：6 份逐文件代码审计（框架/导航、工作台、AI 交互、R 工作台、图表、基础件）+ 第一手核对（globals.css、tabs、SessionView、result-toolbar、session-workspace、README/design-philosophy/charts）。
> 时间：2026-09-03，main 分支 `e1f3b95`。

基调：**全程客观陈述当前代码事实**（布局树、类名、props、状态、交互、问题），不写方案建议（方案见「11. 方案 A 基座」仅列现状事实与积木）。相关既有文档：[design-philosophy.md](design-philosophy.md)（设计哲学）、[charts.md](charts.md)（图表规范）、[ARCHITECTURE.md](ARCHITECTURE.md)（架构决策）、[../AGENTS.md](../AGENTS.md)（规则与活跃坑）、[PLAN.md](PLAN.md)（待办）。

---

## 1. 应用外壳与导航

### 1.1 三层壳与路由

```
RootLayout（服务端）        html lang=zh-CN + 自托管 Geist 字体变量 + body min-h-full 背景/前景 token
└── AppShell（客户端）      ToastProvider → ConnectionProvider → h-screen flex：Sidebar + 内容列
    └── main.min-h-0.flex-1.overflow-auto    ← 全局唯一滚动容器，页面自身用 h-full 子树
```

| 路由 | 页面 | 布局特征 |
| :--- | :--- | :--- |
| `/` | 连接管理（page.tsx） | `mx-auto max-w-2xl p-6` 居中 |
| `/workspace` | 工作台包装层 | Suspense 包裹，`SessionWorkspace key={connection:sql}` |
| `/explorer` | 数据探索 | 全宽 `flex h-full min-h-0 flex-col p-3 sm:p-4`，左右分栏 |
| `/queries` | 查询管理 | `p-4 max-w-3xl mx-auto` 居中 |

后三页消费 `?connection=`，缺参整页提示「请先选择数据库连接」。

### 1.2 AppShell（app-shell.tsx）

```
div.flex.h-screen.min-h-0
├── Sidebar mobileOpen onClose   （fixed 抽屉 → md:relative 常驻）
├── {mobileOpen && 遮罩 button.fixed.inset-0.z-40.bg-[var(--overlay-strong)].md:hidden aria-label="关闭导航"}
└── div.flex.min-w-0.flex-1.flex-col
    ├── 移动顶栏 div.flex.h-11.shrink-0.border-b.px-3.md:hidden
    │   ├── button[data-testid=mobile-nav-open]（Menu 图标，aria-label="打开导航"）
    │   └── span "Data Analytics"
    └── main.min-h-0.flex-1.overflow-auto → {children}
```

- 状态：`mobileOpen` 唯一。遮罩 `--overlay-strong`（30% 黑）。
- 抽屉缺：焦点陷阱、Escape 关闭、aria-expanded。

### 1.3 Sidebar（sidebar.tsx）

```
aside.fixed.inset-y-0.left-0.z-50.flex.w-64.flex-col.border-r.bg-[var(--sidebar)].shadow-xl
     .transition-transform.md:relative.md:z-auto.md:w-52.md:translate-x-0.md:shadow-none
     （移动端 mobileOpen ? translate-x-0 : -translate-x-full）
├── 关闭按钮 button[data-testid=mobile-nav-close].absolute.right-2.top-3.md:hidden（X，aria-label）
├── 品牌 div.px-3.py-3.border-b → Link href="/"：徽标盒 w-6 h-6 bg-[var(--sidebar-primary)] "AI" + "Data Analytics"
├── 连接选择器 div.px-2.py-2.border-b（dropdownRef）
│   ├── 触发器 button.w-full.flex.gap-1.5.px-2.py-1.5.rounded-md.text-[11px]
│   │   （有连接 bg-[var(--sidebar-accent)]；无连接 dashed 虚线框 "选择连接"；ChevronDown open 时 rotate-180）
│   └── {dropdownOpen && 下拉 div.absolute.top-full.left-0.right-0.mt-1.bg-[var(--popover)].border.shadow-lg.z-50}
│       ├── loading "加载中..." / connectionError 红色重试 / 空 "暂无连接"
│       ├── 列表 div.max-h-48.overflow-auto：行 = 圆点（当前 fill-[var(--primary)]）+ 名称 + database（9px）+ Check
│       └── 底部 border-t：Link 管理连接(/) · 新建连接(/?action=create)
├── nav.flex-1.px-2.py-2.space-y-0.5（3 项：/workspace 数据工作台 Terminal · /explorer 数据探索 Search · /queries 查询管理 Clock）
│   └── 每项 Link.flex.gap-2.px-2.5.h-[34px].rounded-md.text-[13px]
│       （active: bg-[var(--sidebar-primary)] 反色 font-medium；disabled: pointer-events-none opacity-48；
│         href 自动拼接 ?connection=id）
└── 底栏 div.px-3.py-2.border-t → span.text-[10px] "v{NEXT_PUBLIC_APP_VERSION ?? ''}"
```

- 下拉：懒加载（首次打开且列表空才 GET /api/connections）；mousedown 外部点击关闭。
- **版本徽标恒渲染前缀 "v"**：env 缺失时显示裸 "v"（AGENTS 活跃坑声称「未配置时隐藏」，与代码不符；但实际上 next.config.ts 总是从 package.json 注入该变量，正常不会缺失）。
- 下拉无 role/aria-expanded/键盘导航；禁用导航项仍在 Tab 序（href="#" + pointer-events-none，无 aria-disabled）；无 aria-current。

### 1.4 连接上下文（connection-context.tsx）

- 无 JSX：Provider 把 URL `?connection=` 解析为完整 Connection 对象。
- 派生：`connection` 仅当 `resolved.id === connectionId` 才返回；`loading = connectionId !== null && resolved.id !== connectionId`。
- **错误与空态不可区分**：请求失败静默置 `connection: null`，UI 表现为「未选择连接」。

### 1.5 Toast（toast.tsx）

- `div.fixed.bottom-4.right-4.z-50.space-y-2`，每条 `animate-in slide-in-from-bottom-2`。
- 类型色：success/error/warning 用三件套（surface/border/text）+ info 用 border/popover。
- 3 秒自动消失 + 手动 X 关闭；无 aria-live、关闭按钮无 aria-label、无队列上限。

### 1.6 外壳层问题清单

1. `page.tsx` openEdit 重置 username/password/ssl（编辑保存会改坏连接配置）
2. ConnectionProvider 错误/空态不可区分
3. Sidebar 下拉与移动抽屉无障碍缺失（无 role/键盘/Escape/焦点陷阱）
4. Toast 无 aria-live
5. 无暗色模式能力（color-scheme: light 锁定，无 .dark 分支）

---

## 2. 主题与样式体系

### 2.1 token 全清单（globals.css，唯一色源）

- 结构：`@import "tailwindcss" + "tw-animate-css" + "shadcn/tailwind.css"` → `@theme inline` 全量映射 → `:root` 具体值 → `@layer base`。
- **色板（仅浅色，color-scheme: light）**：

| token | 值 | 用途 |
| :--- | :--- | :--- |
| `--background/--foreground` | `#ffffff` / `#0a0a0a` | 页面底/前景 |
| `--primary(-foreground)` | `#121212` / `#fafafa` | 主按钮/用户气泡 |
| `--secondary(+hover)` | `#f5f5f5` / `#ededed` | 次级 |
| `--muted(-foreground)` | `#f5f5f5` / `#858585` | 灰条/次级文本 |
| `--accent` | `#f5f5f5` | hover 底 |
| `--destructive(+surface/border)` | `#e7000b` / `#fff1f2` / `#fecdd3` | 错误三件套 |
| `--success(+surface/border)` | `#15803d` / `#f0fdf4` / `#bbf7d0` | 成功三件套 |
| `--warning(+surface/border)` | `#a16207` / `#fffbeb` / `#fde68a` | 警告三件套 |
| `--border` / `--input` / `--ring` | `#e8e8e8` / `#e5e5e5` / `#0d0d0d` | 边框/输入/聚焦环 |
| `--overlay-subtle/strong` | `10%` / `30%` 黑 | 遮罩 |
| `--card` / `--popover` | `#ffffff` | 容器/浮层 |
| `--sidebar-*` | 灰系（bg `#fafafa`、primary `#171717`、ring `#a1a1a1`） | 侧栏 |
| `--chart-1..5` | `#2563eb` / `#0f766e` / `#c2410c` / `#7c3aed` / `#be123c` | 图表离散色板 |
| `--chart-grid` / `--chart-tick` | `#e7edf2` / `#64748b` | 网格/刻度 |
| `--chart-accent/positive/negative` | `#0f766e` / `#15803d` / `#be123c` | 图表强调（直方图/涨跌） |
| `--chart-sequential-low/high` | `#d9f3f0` / `#0f766e` | 顺序色阶 |
| `--chart-diverging-negative/neutral/positive` | `#be123c` / `#f8fafc` / `#2563eb` | 发散色阶 |
| `--chart-missing` | `#e5e7eb` | 缺失格 |
| `--chart-cell-text-strong/muted` | `#ffffff` / `#334155` | 单元格文字 |

- 圆角：`--radius: 0.5rem`，派生 `--radius-sm..4xl = × 0.6 / 0.8 / 1 / 1.4 / 1.8 / 2.2 / 2.6`。控件默认 `rounded-lg`（8px），Card/Dialog `rounded-xl`（11.2px），Badge `rounded-4xl`（≈21px 胶囊）。
- 字体：`--font-sans`（Geist Sans）、`--font-mono`（Geist Mono）、`--font-heading` = sans。全部自托管 `src/app/fonts/`。

### 2.2 基础层规则（@layer base）

- `* { @apply border-border outline-ring/50 }`（全局默认边框色）
- `body { bg-background text-foreground; min-width: 320px }`
- 全局 `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px }`
- `prefers-reduced-motion: reduce` → 全动画 0.01ms
- 组件聚焦风格统一：`focus-visible:border-ring + focus-visible:ring-3 ring-ring/50`

### 2.3 组件惯例（全项目一致）

- 颜色一律 `bg-[var(--xxx)]` 直引变量；**任何组件不得有第二套颜色常量**（src/AGENTS.md 契约，审计确认无违规）。
- 状态色三件套（surface/border/text）贯穿错误条、toast、badge。
- 边框演化：旧式 `border-border/border-input`（表单控件）→ 新式 `ring-1 ring-foreground/10`（Card/Dialog/SelectContent 容器）。
- 紧凑尺寸基调：控件默认 `h-8`、`text-sm` 主 / `text-xs` 次级 / `text-[10px]` 微级（按钮组、徽标、状态条大量使用 10px）。
- 动画：`transition-all/transition-colors duration-100` + tw-animate-css 进出场（data-open/data-closed）。

---

## 3. UI 基础组件库（src/components/ui/）

基底：**@base-ui/react**（非 radix）；cva 定义变体；`cn = twMerge(clsx(...))`（src/lib/utils.ts）。

### 3.1 组件一览

| 组件 | 形态 | 变体 | 状态 |
| :--- | :--- | :--- | :--- |
| button | Base UI Button 包装 | variant 6（default/outline/secondary/ghost/destructive/link）× size 8（default h-8 / xs h-6 / sm h-7 / lg h-9 / icon 系） | 高频全域 |
| input | 原生透传，无 cva | 无 | `h-8 rounded-lg border-input`，`text-base md:text-sm`（防 iOS 缩放），aria-invalid 红环 | 高频 |
| label | 原生 label | 无 | group/peer disabled 联动置灰 | 高频 |
| badge | useRender+mergeProps | 6 变体，默认 primary | `h-5 rounded-4xl` 胶囊；explorer/queries 用 |
| dropdown-select | **手写**（非 Base UI） | 无 | 受控 value/options/placeholder；**无键盘/aria**；裸 `var(--xxx)` 风格；chart-config-panel 用 |
| select | Base UI 全套件（Portal/Positioner/Popup） | size sm/default | **当前零使用**（备件） |
| card | 容器套件，`--card-spacing` 驱动 | size sm/default | **当前零使用**（备件） |
| table | 滚动壳 + 8 子组件 | 无 | **当前零使用**（备件） |

### 3.2 Tabs —— 结果区 Tabs 化关键积木（tabs.tsx）

- API：`Tabs = TabsPrimitive.Root` 全透传（`value/defaultValue/onValueChange/orientation/activationMode/loop` 由 Base UI 提供），唯一显式 prop `orientation`（默认 horizontal）。
- 结构：Root `flex gap-2 data-horizontal:flex-col`（List 上、Content 下，天然上下堆叠）→ `TabsList`（`variant: "default" | "line"`，默认 default：`bg-muted` 凹陷容器 p-[3px] h-8）→ `TabsTrigger`（`flex-1` 等宽、`text-foreground/60` 未激活）→ `TabsContent`（`flex-1 text-sm`）。
- **激活态 = Base UI 的 `data-active`**（非 radix 的 `data-[state=active]`）：`data-active:bg-background text-foreground`；default 变体加 `shadow-sm`；line 变体透明底 + 底部/右侧 2px 指示条（`after:absolute after:bg-foreground`，line 下 `data-active:after:opacity-100`）。
- 原生能力：roving tabindex、方向键、aria-selected、Content 懒挂载，全部由 Base UI 提供。
- 自定义覆盖须走 `group-data-[variant=…]/tabs-list:data-active:…` 前缀，不可套 shadcn 类名。
- explorer/queries 已用 default 变体实例（`TabsList className="h-7"`、trigger `text-[11px] h-5` 风格）。

### 3.3 Dialog（dialog.tsx）

- `Dialog = Root` 全透传（open/onOpenChange/modal/dismissible）。
- `DialogContent`：Portal + Overlay（`fixed inset-0 z-50 bg-[var(--overlay-subtle)] backdrop-blur-xs`）+ Popup（`fixed 居中 max-w-[calc(100%-2rem)] sm:max-w-sm rounded-xl bg-popover ring-1 ring-foreground/10`，fade+zoom 动画）；`showCloseButton` 默认 **true**（右上 ghost X + `sr-only "Close"`）。
- `DialogFooter`：`-mx-4 -mb-4` 贴边、`border-t bg-muted/50`、移动端列向反转；`showCloseButton` 默认 **false**（不一致），内置关闭按钮文案硬编码英文 **"Close"**。
- Title/Description 自动建立 aria-labelledby/describedby（Base UI）。

### 3.4 使用实况

- 高频：Button/Input/Label（全页面）、Dialog（page/chart-config-panel/session-workspace）、Tabs（explorer/queries）、Badge（explorer/queries）、DropdownSelect（chart-config-panel）。
- 备件：ui/select、ui/card、ui/table 零使用——后续改版可直接复用。
- types/index.ts 只有业务类型，无 UI 类型集中层。

---

## 4. 页面

### 4.1 `/` 连接管理（page.tsx）

- `max-w-2xl` 居中；三态：加载中 / 空态（图标盒 + 「暂无数据库连接」+ Dialog#1 新建）/ 列表。
- 列表卡片：`group.flex.items-center.justify-between.rounded-lg.border.bg-[var(--card)].p-3.hover:border-[var(--ring)]`；左（图标盒 + 名称 truncate + `host:port/db · N 表`）可点击进工作台；右：进入（ghost h-7）/ 编辑 / 删除（hover 转 destructive，原生 confirm）。
- 表单：DialogContent `max-w-md`，6 字段（主机/端口、用户名/密码为 `grid-cols-2` 两列），`defaultForm`：host "localhost"、port 5432、username "postgres"、ssl false。
- `?action=create`（shouldCreate）直达新建弹窗，与 sidebar「新建连接」联动。
- 交互：GET 8000ms 超时；POST/PUT 保存成功 refresh；openEdit 重置凭据（见问题 1）；两套几乎重复的 Dialog markup。
- 图标按钮无 aria-label；grid-cols-2 无小屏降级。

### 4.2 `/workspace`（workspace/page.tsx）

- 薄包装：`Suspense` → `WorkspaceRoute`（useSearchParams：`connection`、`sql`）→ `SessionWorkspace key={connectionId + ":" + initialSql}`。
- **key 变化 = 整体重挂载**：切连接或带新 sql 进入都清空工作台状态（有意设计，切换连接丢会话）。

### 4.3 `/explorer` 数据探索（explorer/page.tsx）

```
div.flex.h-full.min-h-0.flex-col.p-3.sm:p-4
├── 头部：h1「数据探索」+ Badge「{n} 表」+ 刷新按钮（RefreshCw，loading 转圈）
├── {error && 错误条 + 重试}
└── div.flex.min-h-0.flex-1.flex-col.gap-3.lg:flex-row
    ├── 左列表 div.flex.max-h-[34vh].min-h-[180px].w-full.flex-col.rounded-lg.border.lg:max-h-none.lg:w-64
    │   ├── 搜索条（Input pl-8 h-7）
    │   └── 表行 = 原生 button（w-full.text-left.px-3.py-2；选中 bg-[var(--accent)] font-medium；
    │       Database 图标 + truncate 表名 + rowEstimate font-mono 10px）
    └── 右详情 div.flex-1.min-h-0 → 选中表：
        ├── 表头（表名 + comment +「在工作台执行」→ /workspace?sql=SELECT * FROM {name} LIMIT 200）
        └── Tabs defaultValue="columns"（TabsList h-7，trigger text-[11px]）
            ├── columns：table.text-xs（字段/类型/可空/说明 4 列；主键 Key 图标 text-[var(--warning)]）
            ├── relations：fromTable.fromColumn → toTable.toColumn（font-mono + Badge）
            └── preview：POST /api/query/preview（schema 硬编码 "public"）；table.text-[11px]
```

- 选表即自动发预览请求（AbortController 竞态守卫）；刷新 `?refresh=true`。
- 问题：预览 schema 硬编码 public、无分页、index key、刷新图标无 aria-label、`String(row[c.name] ?? "")` 对象显示 `[object Object]`。

### 4.4 `/queries` 查询管理（queries/page.tsx）

- `max-w-3xl`；头部「查询管理」+ `{n} 收藏 · {n} 历史`（10px）。
- 搜索框（Search 图标 absolute + Input pl-8 h-8）→ `Tabs defaultValue="saved"`（收藏 Bookmark / 历史 Clock）→ 卡片列表。
- 卡片：名称（历史版含 Badge OK/ERR + `{n} 行` + `{n}ms`）+ 操作组（`opacity-0 group-hover:opacity-100`：执行/复制/删除，h-6 w-6 图标 + title）+ SQL 预览 `pre.text-[10px].font-mono.whitespace-pre-wrap.break-all.bg-muted`.
- 执行 → `/workspace?connection=&sql=${encodeURIComponent(sql)}`；删除 → DELETE + 本地过滤 + toast。
- 问题：hover 才显现的操作按钮触屏不可达；两 Tab 共用 loading；搜索无结果仍显示「暂无收藏」；复制无 try/catch。

---

## 5. 数据工作台（session-workspace.tsx，368 行，唯一实现）

### 5.1 整体布局树

```
div.flex.h-full.min-h-0.flex-col.overflow-hidden.p-3.sm:p-4
├── ① 顶部 div.flex.items-start.justify-between.gap-3.px-1.pb-3
│   ├── 左：title（text-sm font-medium truncate）+ insight（text-xs muted line-clamp-2）
│   └── 右：status 徽标（text-[10px] font-mono；error→destructive 三件套 / busy→muted
│           / ready→success 绿 / 其余 muted；文字 = 英文 status 原文）
├── ② SQL 编辑器区 div.flex.h-48.min-h-0.flex-col.gap-2          ← 固定高 192px
│   ├── 工具行：label「SQL 编辑器」+ 保存（ghost h-7 text-xs，disabled=!compiledSql?.sql）
│   │   + 执行（h-7 text-xs，disabled=busy||!sqlDraft；busy 时 Loader2+"执行中"）
│   ├── div.flex-1.border.rounded-lg.overflow-hidden → MonacoEditor
│   │   （dynamic ssr:false；theme="vs-light" 硬编码；选项：minimap off / fontSize 13 /
│   │     wordWrap on / tabSize 2 / padding 8；loading 占位 animate-pulse）
│   └── {error && 红色 error 条（destructive 三件套 font-mono text-xs）}   ← 恒显示
├── ③ 中部 div.flex.min-h-0.flex-1.flex-col.gap-3.pt-3.lg:flex-row
│   ├── AI 助手卡 div.flex.min-h-[220px].min-w-0.flex-1.flex-col.rounded-lg.border.lg:flex-[2]
│   │   ├── 卡头 px-3.py-2.border-b：label「AI 助手」+ {有历史 && 重置 ghost h-5 10px（RESET）}
│   │   ├── <AiVisibilityHint />                                  ← 见 §6.3
│   │   ├── 消息区 div.flex-1.overflow-auto.p-3.space-y-2.min-h-0
│   │   │   ├── {aiUnavailable && 配置提示条（.env / AI_API_KEY code 高亮）}
│   │   │   ├── 空态居中：「用自然语言描述你想分析的内容」
│   │   │   ├── 气泡：user 右对齐 max-w-[90%] bg-[var(--primary)] text-[var(--primary-foreground)]
│   │   │   │        / assistant 左对齐 bg-[var(--muted)]；均 text-xs whitespace-pre-wrap
│   │   │   └── {aiLoading && 左对齐「思考中...」（Loader2 spin）}
│   │   └── 输入行 div.p-2.border-t.flex.gap-1.5
│   │       ├── <AiMentionInput value onChange onSend disabled placeholder schema />（见 §6）
│   │       └── 发送 Button size=sm h-7 w-7 p-0（Send 图标，disabled=aiLoading||!aiInput.trim()）
│   └── 结果列 div.flex.min-h-0.min-w-0.flex-1.flex-col.lg:flex-[3]
│       └── <SessionView session onMappingChange onCopySql />     ← 见 §7
└── ④ 保存查询 Dialog（max-w-sm：名称 Input h-8 text-xs，Enter 提交，Footer 取消/保存）
```

- 比例：lg 起 AI 助手:结果 = 2:3；lg 以下纵向堆叠（AI 卡 min-h-[220px] 保底）。
- 无连接时整页：`p-6 flex items-center justify-center min-h-[50vh] text-xs`「请先选择数据库连接」。

### 5.2 会话状态机对 UI 的驱动

- `SessionStatus = idle | compiling | executing | ready | error | needs_recompile`（src/types/session.ts）。
- 六个状态 → UI：idle 无结果空白 / compiling+executing = busy（徽标灰 + SessionView loading）/ ready（徽标绿 + 结果）/ error（徽标红 + error 条 [+错误框，仅无旧结果]）/ needs_recompile（徽标灰，useSession 副作用即时决议，UI 无提示）。
- 19 个 Action 的关键 UI 语义（sessionReducer.ts）：
  - `ASK_AI`：追加用户气泡、清 error/validationIssues
  - `INIT_FROM_AI`：**清 result**（旧结果立即消失）、status=compiling、schema-based 校验失败直接 throw
  - `SET_COMPILED_SQL`：status=executing → 副作用执行
  - `EXECUTE_SUCCESS`：ready + data-based 校验写 validationIssues
  - `UPDATE_QUERY_SPEC` / `UPDATE_DISPLAY_CONFIG`（缺映射字段时）：needs_recompile + isUserModified
  - `CHANGE_CHART_TYPE`：纯展示层不重查
  - `RESET`：createInitialSession → 整页重置

### 5.3 用户操作流

1. 输入：AI 助手输入框（@ 选表）或 SQL 编辑器手写
2. AI 路径 `sendAi`：清空输入 → ASK_AI → POST /api/ai（conversationHistory 全量 + `referencedTables: extractMentions(msg)`）→ 取 `items[0]` → INIT_FROM_AI（querySpec 优先，缺失走 `SET_COMPILED_SQL` SQL 直通 + sqlDraft 回填）→ toast「已生成 N 条分析，执行第 1 条」
3. useSession 副作用链：querySpec fingerprint 变化 → 同步编译 → SET_COMPILED_SQL（executing）→ 执行 POST /api/query → EXECUTE_SUCCESS（ready + validationIssues）
4. 手动 `runSql`：**强制 `UPDATE_DISPLAY_CONFIG {chartType:"table"}`** 后 SET_COMPILED_SQL（用户手写 SQL 前选的图表类型被重置）
5. 结果：bindDataToChart 适配 → ResultPanel；用户改映射 → UPDATE_DISPLAY_CONFIG（缺字段 → needs_recompile）
6. 导出/保存：ResultToolbar 四按钮；保存查询 Dialog

### 5.4 工作台已知问题

- AI 多结果只消费 items[0]，InsightCard 组件已实现但未挂接
- runSql 重置图表类型；busy 且旧结果无「重新执行中」视觉提示；needs_recompile 无 UI 提示
- Monaco theme vs-light 硬编码；编辑器 h-48 固定
- 发送按钮无 aria-label；失败后输入内容丢失（提交即清空）

---

## 6. AI 助手交互

### 6.1 组件链与数据流

```
SessionWorkspace（aiInput 受控 state）
└── AiMentionInput（受控 Input h-7 text-xs + useMemo: tables = schema?.tables ?? []）
    ├── useMentionInput(value, onChange, onSend, tables)          ← 状态机 hook
    └── {mentionOpen && AiMentionPanel(tables=filtered, activeIndex, onSelect, onHoverIndex, panelRef)}
         └── div.absolute.bottom-full.left-0.right-0.mb-1（锚点 = 输入组件 div.relative，面板向上弹出等宽）
             └── max-h-52.overflow-auto.rounded-md.border.bg-[var(--popover)].shadow-lg.z-50
                 └── 每项 button：Table 图标 + font-mono 表名 truncate + «N 列»（text-[9px] ml-auto）
```

- 选中：`onSelect → replaceMention(value, name)` 写回父组件 → `inputRef.focus()`（可连续选表，如 `对比 @orders 与 @customers`）。

### 6.2 @mention 状态机（useMentionInput.ts + mention.ts 纯函数）

- 派生开关：`mentionOpen = hasMention && !dismissed && filtered.length > 0`（activeIndex 不参与）。
- 触发条件：`extractPendingMention` 按空白 `\s+` 分词，仅「最后一个词以 @ 开头」触发（**`对比@orders` 不触发**，占位符示例恰是 `对比 @orders`）。
- 键盘：面板开时 ↑↓ 模运算循环、Enter/Tab 选中（拦截）、Escape 关闭（不清输入）；面板关时 Enter（非 Shift）提交。
- 外部点击关闭：`useEffect([])` 注册 document **mousedown**（mousedown 先于 click 且面板是 input 兄弟节点，blur 无法区分内外），panelRef/inputRef contains 豁免。
- 替换：`/@[^\s@]*/g` 最后词替换为 `@name `（尾随空格使面板自然关闭）；无 @ 词时尾部追加。
- 提交提取：`extractMentions` 正则 `/@([A-Za-z_][A-Za-z0-9_.]*)/g`（合法标识符形式 + Set 去重）→ `referencedTables` → 后端只扫这些表。
- `filterTables`：空 query 返回全部表；否则表名小写子串匹配。
- **React 纪律**（react-hooks 7.1.1 约束）：activeIndex/dismissed 只在事件处理器更新；渲染期无 setState/ref 访问。

### 6.3 AiVisibilityHint（ai-visibility-hint.tsx）

- 零 props 静态组件：`div.border-b` → 折叠按钮（Eye 图标 w-3 h-3 + 一行小结「AI 能看见：表结构、数据轮廓与图表契约；看不见原始数据行」，text-[10px]）+ 点击展开详情卡。
- 展开内容 = 静态文案镜像后端注入范围：能看见 4 项（当前连接 Schema 表/字段/数据库类型 · 数据轮廓最多 6 张表 · 图表契约 10 种类型+槽位规则+输出格式 · 会话问答历史）+ 看不见 2 项（原始数据行 · 密码/连接串/账号）+ 只读事务说明。
- 无 aria-expanded/aria-controls；expanded 不受 RESET 影响。

### 6.4 AI 交互已知问题

1. 中文场景 `对比@orders` 不弹面板（分词边界）
2. 全链路无 aria（input 无 aria-autocomplete/controls/expanded；面板无 listbox/option/activedescendant）
3. 面板键盘选中项不自动 scrollIntoView（max-h-52 内可能不可见）
4. 面板开时 Tab 被占用于选表
5. 空输入 Enter 仍调 onSend（依赖 sendAi 内部 guard）
6. 请求失败输入不恢复；aiUnavailable 置位后空态提示消失
7. 面板 `bottom-full` 无翻转逻辑（小屏可能超出视口顶部）

---

## 7. 结果区（改版主战场）

### 7.1 SessionView（SessionView.tsx，100 行）当前布局（从上到下）

```
div.min-h-0.overflow-auto.rounded-lg.border          ← 结果区唯一滚动容器
├── ① 头部条 div.flex.items-center.justify-between.px-3.py-1.5.bg-[var(--muted)]
│   ├── span「分析结果」（text-xs font-medium muted）
│   └── div.flex.items-center.gap-2
│       ├── <ResultToolbar dataset onOpenRWorkbench />        ← 4 按钮挤在此行
│       └── {isUserModified && 「已手动调整」徽标（Pencil + warning 三件套 10px）}
├── ② 内容区 div.p-3.space-y-2
│   ├── validationIssues → ChartNotice（severity=error→warning 色 / 否则 muted 色）
│   ├── bound.warnings → ChartNotice（warning 色）
│   ├── bound.adjustments → ChartNotice（muted 色）
│   ├── <ResultPanel result={…rows: bound.rows} mapping={bound.mapping} onMappingChange />
│   └── <RWorkbench dataset={result} open={rWorkbenchOpen} onClose />（内嵌最底部）
```

- 分支：`busy && !result` → 「查询执行中...」盒（min-h-[200px]）；`error && !result` → 红色错误盒；`!result || !bound` → **null（空白）**；否则正常。
- **busy/error 且有旧结果 → 直接显示旧结果，无任何叠加提示**（仅顶部徽标）。
- 本地 state：`rWorkbenchOpen`（不进 reducer，R 输出是会话外临时状态）。
- `bound = bindDataToChart(result, displayConfig)`：坐标轴交换/无效值过滤 + warnings/adjustments。

### 7.2 ResultToolbar（result-toolbar.tsx）

- `div.flex.items-center.gap-0.5` + 4 个原生 button（btnCls：`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--accent)]`）：
  1. **CSV**（Download，title「导出 CSV（带 UTF-8 BOM，Excel 中文兼容）」）
  2. **JSON**（FileJson）
  3. **R 模板**（Copy，复制 generateRTemplate 代码，copied→「已复制」1.5s）
  4. **R 分析**（FlaskConical，`onOpenRWorkbench` 存在才渲染，最右）
- 导出：`URL.createObjectURL` + a.click；CSV 走 `exportCSV(dataset)`（r-bridge，UTF-8 BOM）；JSON 直接 stringify。
- **挤压事实**：4 个 10px 按钮（含两个 R 相关）+「已手动调整」徽标全部挤在头部条一行，与「分析结果」标题同排。

### 7.3 ResultPanel + ChartConfigPanel

**ResultPanel**（dashboard/result-panel.tsx，83 行）：
- `div.border.rounded-lg.overflow-hidden` → 状态条（`bg-muted`：`{rowCount} 行 | {executionTimeMs}ms | {columns.length} 列` font-mono 11px，分隔符 `text-[var(--border)]`「|」+ 复制 SQL ghost h-6 11px「已复制」1.5s 反馈）→ `p-3` → ChartConfigPanel。
- 受控/非受控双模式：`controlled = mapping !== undefined`；SessionWorkspace 恒受控（非受控分支是遗留死路径）。

**ChartConfigPanel**（chart-config-panel.tsx，258 行）自上而下：
1. 推荐条（仅 `chartType==="table"` 且推荐>0：`recommendCharts(...).slice(0,2)`，按钮显示 CHART_TYPE_INFO.label，点击 `onChange(recommendation.mapping)`）
2. 图表类型网格（`grid grid-cols-4 gap-1.5 sm:grid-cols-5`；激活态反色 `bg-[var(--foreground)] text-[var(--background)]`；ChartIcon w-4 h-4 + label；title=description）
3. correlation 方法（Pearson/Spearman/Kendall 反色按钮）
4. bar 排列方式（分组/堆叠/百分比，`aria-label="柱状图排列方式"`）
5. 列映射槽位（`flex gap-2 flex-wrap`；每槽 `flex-1 min-w-[120px]`：label 10px uppercase + DropdownSelect（必填→「选择列」/「可选」）+ **图例开关**（仅 color/fill 槽有值且 isGroupSlot 时渲染，w-9 h-9 反色 Eye/EyeOff）
6. 必填提示（`validation.issues[0]`，warning 三件套，非 table/correlation 才显示）
7. 可用列 chips（`flex flex-wrap gap-1`，font-mono 10px bg-muted）
8. 图表渲染（`data-testid="chart-surface"`，`overflow-hidden rounded-lg border bg-[var(--card)]` → `<Chart mapping data showLegend />`）
9. 「数据提示」确认弹窗（分组槽位拦截：抽样前 20 行数值占比 >80% →「数值列不适合做分组/分类，建议使用文本列」；唯一值 >20 →「该列有 N 个唯一值，分组较多可能影响图表展示效果」；确认后才 onChange）
- 问题：`isGroupSlot`（color/fill）与检查范围（color/fill/category）不一致；showLegend 是局部 state 不回流 session（DisplayConfig.showLegend 类型已预留未接回）；切图表类型 createMappingForChart 全量重置映射。

### 7.4 InsightCard（已实现未挂接）

- 单条 AI 洞察卡：序号「01」（font-mono 10px）+ 标题 truncate + 展开 SQL 按钮（ChevronRight/Down）+ 执行按钮（ghost h-6 10px，onExecute(item.sql, item.chart)）+ 洞察说明（11px）+ 卡片级错误条 + 展开区（bg-muted：pre 10px font-mono + 元信息「图表: type | 映射: key=val」9px）。
- hover:border-[var(--ring)]（全站少数用 ring 描边处）。
- 当前无任何调用方（session-workspace 只取 items[0]）。

### 7.5 错误呈现矩阵（跨文件）

| 场景 | 呈现 |
| :--- | :--- |
| 编译/执行错误 | ① 编辑器下方红条（恒显）② SessionView 红框（仅无旧结果）③ 徽标红。**有旧结果时仅靠徽标** |
| AI 请求失败 | 错误消息写入 assistant 气泡；AI_NOT_CONFIGURED 额外横幅 + toast warning |
| AI 空结果 | assistant 气泡「未生成有效结果」+ toast warning |
| 数据质量问题 | ChartNotice 统一警告（warning/muted 两档，非阻塞） |
| 分组槽位风险 | ChartConfigPanel 内联确认弹窗（拦截后应用） |
| 保存失败 | toast error |
| 图表渲染异常 | ChartErrorBoundary 320px 失败卡 + 重试（见 §8.5） |

---

## 8. 图表体系（charts/）

### 8.1 10 种图表与实现

| 类型 | 实现 | 场景要点 |
| :--- | :--- | :--- |
| line 折线图 | Recharts | 时间/有序趋势；多序列按 colorKey；自动检测时间 X 排序（connectNulls=false 断线） |
| bar 柱状图 | Recharts | 分类对比；mode: grouped/stacked/normalized（用户显式选择）；X 轴 >6 类 -45° 斜标签 |
| pie 饼图 | Recharts donut | 占比；categoryLimit 截断 +「其他」合并提示；标签含百分比 |
| scatter 散点图 | Recharts | 双数值分布；colorKey 分组；pointLimit 确定性抽样（ChartNotice 显示过滤/抽样数） |
| boxplot 箱线图 | 手写 SVG | 须线/中位/四分位/异常值/n 计数；组名 >10 字符截断 |
| heatmap 热力图 | 手写 SVG | X×Y 交叉；顺序/发散双色标（color-mix）、缺失格独立 token；截断提示（20 唯一值） |
| correlation 相关矩阵 | 手写 SVG + Web Worker | pearson/spearman/kendall；色带图例 ±1；每格 n=样本量；Worker 防串台 |
| histogram 直方图 | Recharts Bar | Freedman–Diaconis 分箱（IQR=0 回退 Sturges，5–50 箱）；「{方法} 分箱 · N 个有效值」说明 |
| kpi 指标卡 | 纯 HTML | 单值 + 标签 + 同比 ↑↓% 对比（**取 data[0] 首行**；delta=0 显示「↑ 0.0%」缺陷） |
| table 数据表 | 原生 table 虚拟滚动 | 400px 视口、ROW_HEIGHT 32、OVERSCAN 6；列宽拖拽/键盘 ±16、96–360px 持久化 localStorage |

### 8.2 分发与校验（charts/index.tsx）

- `ChartInner`（React.memo）→ `data.length === 0 → EmptyState「暂无数据」`；否则 switch(chartType) → 字段校验（缺一返回中文 EmptyState，如「请选择 X 轴和 Y 轴字段」）→ `<ChartErrorBoundary resetKeys={[mapping, data]}>` → 视图。
- 统一高度：所有图表 320px（除 histogram 空态 280px）；调度线/网格用 COLORS（8 token 循环）、AXIS_CONFIG（11px）、GRID_CONFIG（3 3 虚线）。
- **限额**：散点 2000 点采样、相关矩阵 20 数值列 / 2000 行、饼图默认 8 类「其他」、热力图 20 唯一值；查询默认 5000 行（后端）。

### 8.3 数据管线（调用顺序）

`profileData → recommendCharts → createMappingForChart → validateChartMapping → Chart 组件`；视图内 `transform.ts`（prepareGroupedSeries O(n) Map 索引 / groupPieData / sampleScatterData / buildHeatmap）与 `algorithms.ts`（computeBoxStats Type7 / computeHistogram / computeCorrelation）。

### 8.4 容器宽度自适应（三策略）

1. Recharts 系：`ResponsiveContainer width="100%" height={320}`
2. boxplot：`useContainerWidth`（ResizeObserver，默认 500px，首帧可能闪 500px 宽度）
3. heatmap / correlation：固定像素 svg + 外层 `overflow-auto` 横向滚动；table：400px 视口纵向虚拟滚动、宽度 = Σ列宽

### 8.5 错误防御三层

1. 空数据 → EmptyState（index.tsx 顶层）
2. 配置缺失 / transform 失败 → 中文 EmptyState
3. 渲染异常 → ChartErrorBoundary（`getDerivedStateFromError` + `resetKeysChanged` 自动复位 + 「重试」按钮）
4. 异步态：相关矩阵「正在计算相关矩阵...」（requestId + 状态比对防旧结果闪烁）

### 8.6 图表体系已知问题

1. histogram 的 mapping.color 定义但分发时丢弃（index.tsx 只传 valueKey）
2. histogram 内联轴/网格配置与 constants 漂移（10px vs 11px）
3. KPI delta===0 显示「↑ 0.0%」
4. heatmap/boxplot svg 无 role/aria（correlation-heatmap 有 role="img" 但 aria-label 混英文方法名）
5. 空态高度 280 vs 320 不统一；KPI 多行静默取首行
6. table End 键滚动量未减视口高；localStorage 键随列组合累积
7. useContainerWidth 无 useLayoutEffect（首帧 500px）；boxplot `Math.min(...)` 大数组栈风险
8. 无 zoom/下钻交互；错误边界不展示具体 error 信息

---

## 9. R 分析工作台（r-workbench/ + useWebR + webr-client + r-bridge）

### 9.1 接入位置与打开方式

- 入口：SessionView 头部条 ResultToolbar「R 分析」按钮（FlaskConical）→ 局部 state `rWorkbenchOpen` → `RWorkbench` 渲染在 ResultPanel 下方（同 `p-3 space-y-2` 容器，`mt-3` 分隔，**内嵌展开**，非浮层）。
- 与「R 模板」双入口并存：模板 = 复制代码到剪贴板供外部 RStudio；R 分析 = 浏览器内 WebR。两按钮同尺寸无主次。
- R 输出不写回 AnalysisSession（AGENTS + 代码双重边界）；数据单向：`session.result → dataset prop → injectData → df <- data.frame(...)`。

### 9.2 面板布局树（自上而下）

```
div.rounded-lg.border.mt-3.overflow-hidden
├── Header（flex justify-between px-3 py-1.5 bg-muted）
│   ├── 「R 分析 · df（N 行 × M 列）」（text-xs font-medium）
│   └── 关闭 ghost h-5 10px（X +「关闭」，aria-label + title「关闭（Esc）」）
├── Toolbar（flex gap-1 px-1）：运行（sm，disabled=busy，title 含 Ctrl+Enter）
│   / 中断（outline，disabled=!busy||!canInterrupt）/ 清空（ghost）/ 复制（ghost ml-auto）均 h-6 10px
├── 内容区 div.p-2.space-y-2
│   ├── Editor：dynamic Monaco（language="r"，min-h-[200px] flex-1；onMount 注册 action id="r-run"
│   │   keybindings=[2049 //Ctrl+Enter]；minimap off / fontSize 13 / wordWrap on；theme vs-light）
│   └── Output：aria-live="polite" min-h-[80px] max-h-[280px] overflow-auto bg-muted font-mono 11px
│       ├── 空且不忙「等待运行...」/ 忙且空「执行中...」
│       ├── >500 条 → 黄色「输出过长，仅显示最近 500 条」；slice(-500)
│       ├── 输出项分级：error/stderr → pre role="alert" destructive；warning → warning-surface 块；
│       │   message → muted；默认 stdout → foreground（均 whitespace-pre-wrap break-all）
│       ├── images 全部追加（canvas：max-w-full h-auto，drawImage + cleanup image.close()）
│       └── 尾部 endRef useEffect scrollIntoView({block:"end"}) 自动滚底
└── StatusBar（flex justify-between px-3 py-1 10px muted）
    ├── 左：busy ?「执行中...」:「就绪」+ 有包时「 · 已加载包: {join}」
    └── 右：lastExecMs「上次执行 {(s).toFixed(2)}s」
另有条件提示行：injectedFor===null && ready →「数据注入中...（首次加载 R 运行时约 8MB...）」
```

### 9.3 生命周期与数据流（webr-client.ts / useWebR.ts）

- `useWebR`：模块级单例 `WebRClient` + `useSyncExternalStore`；actions useMemo 稳定引用。
- bootstrap（open 时）：init → ensurePackages(["dplyr","ggplot2"]) → injectData → setInjectedFor → setCode（模板非空且 ≠ generateRTemplate(dataset) 才不覆盖）。
- SAB 通道显式锁定 `ChannelType.SharedArrayBuffer`（保证 interrupt 能力）；COI 头已配置（COOP/COEP）。
- 执行：`withTimeout(execute(code), 60_000)`，超时输出 error + interrupt()；R.wasm/包从 CDN 按需加载（离线不可用，刷新重下）。
- 全局快捷键（document 级）：Esc 关闭 / Ctrl+Shift+C 清空 / Ctrl+Shift+E 中断。
- injectData >100,000 单元格仅追加 warning（bind 预留路径 TODO，仍 evalR 字符串注入）。
- open=false 时 return null（单例不销毁仅隐藏）；destroy 无 UI 入口。

### 9.4 R 工作台已知问题

1. `webR.error`（init 失败）完全无 UI 消费——失败静默「假死」；StatusBar 只看 busy，「就绪」误显（status="error" 时仍显示就绪）；loading 态无 UI 分支
2. 输出 key 用索引（500 截断错位风险）；自动滚底无「用户上滚暂停」
3. canvas 无 role/alt；状态栏无 aria-live
4. busy 单一布尔无法区分装包/执行（包下载无进度）
5. 页面离开无 WebR 资源释放；dev HMR 重建单例（注释自曝）
6. Ctrl+Enter 用魔法数字 2049；`canInterrupt` 硬编码 true；handleCopy 无失败兜底
7. 模板小不一致：TYPE_COMMENT temporal 恒注 Date 但可能生成 as.POSIXct；plot(df) 兜底可能报错；withTimeout 不取消底层执行仅靠后续 interrupt

---

## 10. 全局已知问题汇总（按影响分级）

### 高（数据/功能性）

1. `page.tsx` openEdit 重置 username/password/ssl——编辑保存会改坏连接配置
2. WebR init 失败全 UI 静默 + 状态栏误显「就绪」
3. busy/error 且已有旧结果时无任何叠加提示（改配置后重查无反馈）
4. AI 多结果只执行第一条（InsightCard 闲置未挂接）
5. runSql 强制重置图表类型为 table
6. ConnectionProvider 错误/空态不可区分

### 中（一致性/边界）

7. 「AI 能看见」文案是静态镜像（后端 prompt 改动不自动同步）
8. needs_recompile / truncated（SemanticDataset 截断元数据）UI 无呈现
9. dropdown-select 无键盘/aria 且裸 var() 风格（体系外组件）
10. dialog Footer 「Close」硬编码英文 + showCloseButton 默认值不一致
11. histogram mapping.color 丢弃；KPI delta=0 显示 ↑；图表配置漂移等（§8.6）
12. `对比@orders` 不触发 @ 面板（分词边界）；面板无翻转/自动滚动
13. explorer 预览硬编码 schema public、无分页；queries 触屏 hover 按钮不可达
14. sidebar 版本徽标「v」前缀；下拉缓存不随连接增删刷新
15. Monaco vs-light 不随主题（当前无暗色，暂无实际影响但硬编码）

### 低（无障碍/打磨）

16. 全站图标按钮依赖 title 而非 aria-label；下拉/抽屉/面板/toast 无 aria-live/role/aria-expanded 等（区域集中在 sidebar 下拉、@面板、toast、R 状态栏、图表 svg）
17. 失败后 AI 输入不恢复；空输入 Enter 静默
18. `!result` 时结果列空白无占位；histogram 空态 280px 不一致
19. 无暗色模式能力
20. workspace key 重挂载 = 切换连接丢工作台状态（设计如此，需确认）

---

## 11. 方案 A（结果区 Tabs 化）改造基座 —— 现状事实

- **目标现状**（用户反馈「很挤」的直接材料）：
  - 结果区头部条一行挤下：标题「分析结果」+ ResultToolbar 4 按钮（10px）+「已手动调整」徽标
  - R 工作台以「内嵌区块」堆叠在 ResultPanel 下方（同一滚动容器内），打开后结果被推长，需整体滚动
  - AI 助手与结果区在 lg 上并排 2:3，中屏以下纵向堆叠；结果区还有自己的滚动容器（嵌套滚动）
- **现成积木**：
  - `ui/tabs`：Base UI Tabs，`variant="line"` 透明底 + 底部指示条适合结果区顶部导航；Content `flex-1` 撑满；激活态为 `data-active`（非 radix 语法）
  - `ui/select` 成品备件（可替换手写 dropdown-select）；`ui/card`、`ui/table` 备件
  - `Dialog` 支持任意内容承载
- **改版必须遵守的既有契约**（ARCHITECTURE / AGENTS / design-philosophy）：
  - 状态唯一真相：RWorkbench 开关等会话外临时状态可留局部 useState，但结果区展示内容（result/displayConfig）必须继续由 session 驱动
  - R 数据单向流入（session.result → df），不写回 AnalysisSession
  - 颜色只用 globals.css 语义 token；图表颜色不建第二套常量
  - 稳定性接口：加载/成功/空/失败/取消/重试状态齐全，截断提示显式（Tabs 切换不丢这些）
  - 推荐是建议不是隐式决策：首次结果保持表格、用户主动选择才切图表（Tabs 默认页若为图表需再议）
  - 导出收敛为「下载」下拉时，CSV/JSON/R 模板/R 分析的 title 提示语（BOM/兼容性说明）应保留
  - Monaco 接入必须 import `@/lib/monaco-setup`（本地引擎）
- **挂接点清单**（Tabs 化改动的文件范围）：`SessionView.tsx`（拆分头部条/内容区）、`result-toolbar.tsx`（收敛下载菜单）、`dashboard/result-panel.tsx` + `chart-config-panel.tsx`（图表 Tab）、`table-view.tsx`（数据表 Tab，已有成品）、`r-workbench/r-workbench.tsx`（R 分析 Tab，open 语义改为 Tab 激活）、`ui/tabs.tsx`（直接复用）。

---

## 12. 附录

### 12.1 审计文件清单（按模块）

- 框架/导航/主题：layout.tsx · page.tsx · workspace/page.tsx · queries/page.tsx · explorer/page.tsx · globals.css · layout/app-shell.tsx · layout/sidebar.tsx · layout/connection-context.tsx · toast.tsx
- 工作台：workspace/session-workspace.tsx · SessionView.tsx · dashboard/result-panel.tsx · result-toolbar.tsx · insight-card.tsx · chart-config-panel.tsx · hooks/useSession.ts · hooks/sessionReducer.ts · types/session.ts
- AI 交互：ai-mention-input.tsx · ai-mention-panel.tsx · ai-visibility-hint.tsx · hooks/useMentionInput.ts · lib/mention.ts
- R 工作台：r-workbench/（index · r-workbench · header · toolbar · editor · output · output-item · image · status-bar）· hooks/useWebR.ts · lib/webr-client.ts · lib/r-bridge.ts · lib/monaco-setup.ts
- 图表：chart.tsx · charts/（index · types · constants · chart-notice · empty-state · error-boundary · chart-icons · hooks/use-container-width · hooks/use-grouped-data · use-correlation-matrix · utils）+ views/（10 个）
- 基础件：ui/（button · input · select · dropdown-select · card · label · table · badge · tabs · dialog）+ lib/utils.ts

### 12.2 相关文档索引

- 设计哲学与边界：[design-philosophy.md](design-philosophy.md)
- 图表规范（算法/限额）：[charts.md](charts.md)
- 架构决策：[ARCHITECTURE.md](ARCHITECTURE.md)
- 规则与活跃坑：[../AGENTS.md](../AGENTS.md) · [../src/AGENTS.md](../src/AGENTS.md)
- 待办与方案状态：[PLAN.md](PLAN.md)
- 源码手册（目录职责/路由）：[../src/README.md](../src/README.md)