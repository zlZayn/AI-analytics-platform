# 页面结构文档

## 一、页面总览

布局采用左侧固定侧边栏 + 右侧内容区的两栏结构。

侧边栏包含：Logo、连接下拉选择器、三个导航项（数据工作台、数据探索、查询管理）。右侧内容区根据当前路由显示对应页面。

---

## 二、页面路由

| 路由 | 文件 | 功能 |
| :--- | :--- | :--- |
| `/` | `page.tsx` | 连接选择与管理 (侧边栏下拉切换) |
| `/workspace?connection=xxx` | `workspace/page.tsx` | 数据工作台 (SQL + AI) |
| `/explorer?connection=xxx` | `explorer/page.tsx` | 数据探索 (Schema 浏览) |
| `/queries?connection=xxx` | `queries/page.tsx` | 查询管理 (收藏 + 历史) |

---

## 三、页面跳转逻辑

**首页 (/)**：点击连接行进入工作台，或通过侧边栏下拉切换连接（不跳转页面）。

**数据工作台 (/workspace)**：左侧 SQL 编辑器，右侧 AI 助手。AI 生成 SQL 自动填入左边，执行后结果显示在下方。可保存查询到查询管理。

**数据探索 (/explorer)**：浏览表结构、字段详情、关联关系、数据预览。点击"在工作台执行"跳转到工作台并预填 SQL。

**查询管理 (/queries)**：收藏的查询和执行历史。点击"执行"跳转到工作台并预填 SQL。

---

## 四、页面详细设计

### 1. 连接管理 `/`

管理 PostgreSQL 数据库连接。显示连接列表，每个连接显示名称和数据库地址，可点击进入工作台或进行编辑/删除操作。顶部有新建连接按钮。

### 2. 数据工作台 `/workspace`

核心工作区，SQL 和 AI 左右分栏。查询后自动收起编辑器，可视化区域更大。

展开状态：左侧是 SQL 编辑器 (Monaco Editor)，右侧是 AI 助手（自然语言输入框 + 对话历史）。编辑器上方有执行、清空、保存按钮。

收起状态：只显示一行 SQL 预览条，点击可展开。

下方是查询结果区域：图表类型选择 (8 种)、图例开关、列映射槽位、图表渲染。

### 3. 数据探索 `/explorer`

左侧是表列表（支持搜索），右侧是详情区域，包含三个标签页：字段（列名/类型/可空）、关联（外键关系）、预览（数据样本）。选中表后可点击"在工作台执行"跳转到工作台并预填 SQL。

### 4. 查询管理 `/queries`

两个标签页：收藏和历史。收藏页显示保存的查询（名称 + SQL），历史页显示执行记录（状态/行数/耗时 + SQL）。每条记录有执行、复制、删除按钮。点击执行跳转到工作台并预填 SQL。

---

## 五、布局组件

### AppShell

顶层布局，包含 Suspense + ToastProvider + ConnectionProvider + Sidebar + Main。

### Sidebar

左侧导航，包含:

- Logo
- 当前连接信息 (从 URL 读取 connectionId)
- 导航菜单 (3 个页面: 工作台/探索/管理)
- 版本号

### ConnectionProvider

React Context，从 URL 读取 `?connection=xxx`，加载连接信息，提供给所有子组件。

### ToastProvider

操作反馈通知系统，提供 `useToast` hook。

---

## 六、共享组件

| 组件 | 文件 | 用途 |
| :--- | :--- | :--- |
| ChartConfigPanel | `components/chart-config-panel.tsx` | 图表类型选择 + 图例开关 + 变量映射 + 渲染 |
| ResultPanel | `components/dashboard/result-panel.tsx` | 查询结果展示 (状态栏 + 图表) |
| ChartIcon | `components/charts/chart-icons.tsx` | SVG 图标映射 |
| DropdownSelect | `components/ui/dropdown-select.tsx` | Vercel 风格下拉选择 |

---

*文档版本: v1.23.0*
*最后更新: 2026-06-26*
