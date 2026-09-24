# r-workbench/ — R 分析工作台

- `r-workbench.tsx`：**右侧停靠面板**（sheet）容器、生命周期与快捷键。
- `r-workbench-body.tsx`：内容区（代码 + 分割条 + 输出），纵向比例由它持有。
- `r-workbench-editor.tsx`：本地 Monaco 编辑器。
- `r-workbench-output.tsx` / `output-item.tsx`：stdout、错误和图像输出。
- `r-workbench-toolbar.tsx` / `status-bar.tsx`：运行、清空、取消与状态。

## 布局契约（面板不参与结果区 flex 流）

- **呈现**：`fixed inset-y-0 right-0 z-[60]`，宽度可拖（像素语义 420–1200px，默认 620px，窄屏全宽），打开时从右侧平移进入；**结果区布局完全不受影响**（旧实现内嵌在结果区里，一打开就把编辑器挤成细长条）。
- **纵向四段**：头部（身份 + 数据规模 + 关闭）→ 工具栏（运行/中断/清空/复制）→ 内容（代码 + 分割条 + 输出）→ 状态栏；每段自己 `shrink-0`，滚动只发生在代码/输出内部。
- **代码/输出比例可拖拽**：复用 `ui/split-handle` + `hooks/useSplitRatio` + `SPLIT_PRESETS.rWorkbench`（默认 62%，夹在 35%..80%，两侧都有最小高度；比例本地记忆）；读取与句柄都在 `r-workbench-body.tsx` 内，面板容器不碰这个比例。
- **关闭 = 平移出屏**：首次打开后保持挂载（由 `SessionView` 的 `rWorkbenchPinned` 在事件处理器里决定），代码与输出在关闭/重开之间保留；关闭后 `aria-hidden + inert`，不拦截结果区交互。
- **模板先于运行时**：打开即写入 R 模板，初始化失败（离线/CDN 不可用）也能读、改、复制代码。
- **历史**：每次执行经 `lib/history-client.ts` 落一条服务端记录（`analysis_history` 表，**作用域键 = 连接 id**，携带 `sessionId` 溯源、`sourceSql` 回放锚点与 `imageCount` 图片张数；文本输出可回放、图片不持久化）；重开面板优先恢复上次代码，但**去掉旧的数据加载块并用当前数据集重建 `df`**（否则会用旧数据），文本输出只在面板生命周期内回放一次；只有图没有文本的执行同样落库。
- **历史回放**：查询管理页「执行」带 `?r=<id>` 时，结果就绪后自动打开面板、**清空旧输出与旧图并重新执行该条代码**（图片不持久化，只能重绘）；id 在本地不存在时明确提示，不静默换成最近一条。无 `sourceSql` 的旧记录不提供回放入口。
- **画布与注入**：`ImageBitmap` 归 `WebRClient`（组件不 `close()`，只做零尺寸守卫）；**模板/用户代码不得自行开或关图形设备**（`webr::canvas()` / `dev.off()`）——webR 按执行前后画布缓存差集收图，自己关掉就收不到；顶层表达式由 `withAutoprint` 自动打印；`injectData` 未完成时运行会等待注入，状态栏显示 `injecting`。

## 契约（数据与边界）

- 数据单向：`session.result → dataset → injectData → df <- data.frame(...)`；R 输出不写回 AnalysisSession。
- `useWebR` 绑定模块级 `WebRClient` 单例（`useSyncExternalStore`）；bootstrap = 注入数据 + 装 dplyr/ggplot2；执行 `withTimeout(60s)`，超时输出 error 并 interrupt。
- SAB 通道显式锁定 `SharedArrayBuffer`，依赖 COI 头（COOP/COEP，见 `next.config.ts`）。
- 输出项带唯一自增 id（截断后不错位）；超过 500 条只保留最近 500 条并提示；自动滚底按 40px 阈值暂钉，用户上滚即暂停。
- 快捷键：Esc 关闭 / Ctrl+Shift+C 清空 / Ctrl+Shift+E 中断；编辑器内 Ctrl+Enter 运行。
- R.wasm 与 R 包从 `webr.r-wasm.org` 按需加载，离线不可用，刷新页面需重下（包缓存在会话内保留）。

## 已知问题（待清理）

- 图像输出无 role/alt；状态栏无 aria-live（面板级已有 `aria-live` 状态行）。
- 历史回放走 URL `?r=<id>`：记录在服务端，换端口/换浏览器都能取到；记录被清理时面板提示「未找到」而不是换一条。
- busy 是单一布尔，无法区分装包与执行（包下载无进度）。
- 页面离开不释放 WebR 资源；`canInterrupt` 硬编码 true；复制无失败兜底。
