# 决策：WebR 接入与 COI 头（2026-09-03）

已实施：next.config.ts 配置 COOP/COEP；webr@0.6.0 已安装并最小验证通过

## 问题

R 分析工作台（P1）需要在浏览器中运行 R 代码。WebR 主线程与 Worker 的通信通道默认使用 SharedArrayBuffer，Chrome 要求页面满足跨源隔离（COI）才可用；且 R 包需从 CDN 下载。

## 决策

- 在 `next.config.ts` 的 `headers()` 中配置 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`（source 覆盖 `/(.*)`）
- 通道策略：`new WebR()` 不传 `channelType`，让 WebR 自动选择（SAB 可用则用 SAB，否则降级 PostMessage）
- 包策略：每次从 CDN 按需下载，不启用 IDBFS 持久化（SAB 通道与 IDBFS 不兼容，硬性二选一；数据分析场景下等待可接受，且保留 interrupt 能力）
- 临时验证页（/webr-test）在门禁通过后已删除，不污染仓库

## 替代方案（强制）

- 硬编码 PostMessage 通道：牺牲 SAB 通道的 interrupt 能力（长 R 代码无法中断）；本项目 5000 行结果分析场景可接受，但保留 SAB 收益更大
- IDBFS 持久化包缓存：需切 PostMessage 通道（SAB 不支持 IDBFS）；换来二次打开免下载。列为 P1 后期优化项，遇到"包下载等待"真实反馈再启用
- 预打包 R 包进静态资源：完全离线但构建流程复杂、包版本固定，过度设计

## 影响

- COI 要求 `require-corp`，第三方跨域资源需带 CORP 头或自托管；项目字体已自托管、无第三方 CDN，破坏面≈0（P1a 全页面 E2E 实测通过）
- 验证记录：`crossOriginIsolated === true`；WebR init 成功；`1+1 = 2` 执行成功
- 关联：E2E 脚本 `offline_workspace_e2e.py` 补充了 `/api/schema/test*` mock（会话版 workspace 初始化会请求 schema，原脚本未覆盖导致 404）——脚本与代码同步修复