# r-workbench/ — R 分析工作台

- `r-workbench.tsx`：容器与生命周期。
- `r-workbench-editor.tsx`：本地 Monaco 编辑器。
- `r-workbench-output.tsx` / `output-item.tsx`：stdout、错误和图像输出。
- `r-workbench-toolbar.tsx` / `status-bar.tsx`：运行、清空、取消与状态。

## 契约

- 入口：结果区「导出 ▼」→「R 分析」；面板内嵌展开（非浮层），关闭只隐藏不销毁单例。
- 数据单向：`session.result → dataset → injectData → df <- data.frame(...)`；R 输出不写回 AnalysisSession。
- `useWebR` 绑定模块级 `WebRClient` 单例（`useSyncExternalStore`）；bootstrap = init → 装 dplyr/ggplot2 → injectData → 写模板；执行 `withTimeout(60s)`，超时输出 error 并 interrupt。
- SAB 通道显式锁定 `SharedArrayBuffer`，依赖 COI 头（COOP/COEP，见 `next.config.ts`）。
- 输出项带唯一自增 id（截断后不错位）；超过 500 条只保留最近 500 条并提示；自动滚底按 40px 阈值暂钉，用户上滚即暂停。
- 快捷键：Esc 关闭 / Ctrl+Shift+C 清空 / Ctrl+Shift+E 中断；编辑器内 Ctrl+Enter 运行。
- R.wasm 与 R 包从 `webr.r-wasm.org` 按需加载，离线不可用，刷新页面需重下（包缓存在会话内保留）。

## 已知问题（待清理）

- 图像输出无 role/alt；状态栏无 aria-live。
- busy 是单一布尔，无法区分装包与执行（包下载无进度）。
- 页面离开不释放 WebR 资源；`canInterrupt` 硬编码 true；复制无失败兜底。
