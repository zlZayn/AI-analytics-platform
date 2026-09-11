# 统一历史记录模块 + R 画布所有权与注入串行化

- 日期：2026-09-11
- 范围：`src/lib/history-store.ts`（新增）、`src/lib/webr-client.ts`、`src/hooks/useWebR.ts`、`src/components/r-workbench/*`、`src/hooks/useAiAssistant.ts`、`src/lib/split.ts`

## 背景（用户可见症状）

1. R 工作台输出区出现一块巨大的空白画布（`max-w-full h-auto rounded border` 的空白区域）。
2. ggplot 代码能跑通但没有图。
3. 换一条 SQL 重新查询后，R 面板里 `df` 有时还是旧数据。
4. 用户要求：「无论是 AI 助手会话还是 R 面板执行过的，都需要自动保存，统一管理这块设计个模块」（澄清：指历史记录）。

## 决策

### 1. 历史记录统一到一个模块，但按「当前状态 / 过往记录」分层

- 新增 `src/lib/history-store.ts`：单一命名空间 `analytics-history:v1:<scopeId>`、单版本号、单上限（50 条），承载两类记录——
  `{kind:"ai", connectionId, question, ok, summary, items}` 与 `{kind:"r", code, output, ok}`；
  提供 `listHistory / listHistoryByKind / latestRHistory / appendHistory / toPersistedOutput / clearHistory`。
- `src/lib/workspace-store.ts` **不动**：它保存的是「当前工作台状态」（会话骨架 + 洞察流），历史模块保存的是「发生过什么」。
  两者职责不同、键不同、生命周期不同（前者要能自动恢复，后者只做回看与回放）。
- R 文本输出落历史时必须截断（`R_OUTPUT_MAX_LINES = 40` / `R_OUTPUT_MAX_CHARS = 4000`），**图片不持久化**（ImageBitmap 无法序列化，存 base64 会把 sessionStorage 撑爆）。

### 2. R 画布所有权归 WebRClient

- `ImageBitmap` 由 `webr::canvas()` 交付，所有权属于 `WebRClient`；React StrictMode 下组件 effect 双跑，
  第一轮 cleanup 若 `close()` 掉位图，第二轮就拿不到像素，canvas 退回默认 300×150 —— 这正是「巨大空白区域」的成因。
- 组件只负责 `drawImage` 与尺寸守卫（`width/height === 0` 时画 0×0），**永不 `close()`**。

### 3. 图形捕获必须显式开启

- webr 0.6 的 `captureR` 选项 `captureGraphics` **默认 false**，所以 ggplot 出图后传不回主线程 → 「没有图」。
- `execute()` 固定传 `captureGraphics: true`。

### 4. 注入与执行串行化

- 数据集换新时先 `injectData`（`df <- data.frame(...)`），若用户立刻点运行，旧的 `df` 会赢 —— 这是「还是旧 df」的成因。
- `WebRClient` 记录 `pendingInjection`，`execute()` 先 `await` 它；同时把 `injecting` 暴露到 `useWebR` 状态，
  面板状态栏与工具栏据此显示「正在注入当前结果集为 df…」并禁用运行，失败也不阻塞（`then(ok, ok)`）。

### 5. 历史恢复必须与当前结果集一致

- 重开面板恢复上次代码时，先 `stripDataFrameAssignment()` 去掉旧的 `df <- data.frame(...)` 块，再用 `buildDataFrameCode(dataset)` 前置，
  保证 `df` 永远对应当前查询；文本输出只在本组件生命周期内回放一次（`restoredOutputRef`），不覆盖本次会话的输出。

### 6. R 面板宽度复用同一分割原语

- `SPLIT_PRESETS.rWorkbenchWidth`（0.43，0.25–0.85，键 `r-workbench-width`）与既有三个预设共用 `SplitHandle` + `useSplitRatio`；
  面板宽度是**像素语义**（420–1200px），由 `ratio × documentElement.clientWidth` 换算 —— 同一句柄，只是比例换成像素解释，不新增组件。

## 被否的备选

| 方案 | 否掉的原因 |
| --- | --- |
| 新建独立 history 存储引擎（IndexedDB / 服务端表） | 当前需求是「刷新/切页内可回看」，sessionStorage 足够；上服务端要引入迁移与权限，违反"复杂逻辑留给后端但别为简单需求造后端" |
| 把历史并进 `workspace-store` | 会把「当前状态」与「过往记录」耦合进同一份快照，恢复逻辑必须区分两者，反而更难维护 |
| 组件里 `close()` 位图并每轮重建 | StrictMode / 未来并发渲染下时序不可控，且位图不是组件的资源 |
| 用 `canvas.toDataURL()` 存图片历史 | 图片体积大、sessionStorage 配额 5MB 级，且回放价值低（代码可重跑） |
| 注入时禁用运行按钮直到 `injecting` 结束（只做 UI 锁） | 只挡 UI 挡不住程序化执行（洞察卡片、快捷键），必须由 `WebRClient` 串行化 |

## 验证

- 单测：`src/lib/__tests__/history-store.test.ts`（顺序/版本与 scope 隔离/坏记录忽略/截断/清空）、`src/lib/__tests__/split.test.ts`（四个预设契约）。
- 离线 E2E：R 面板开/关、分割句柄数量、切页不自动重跑等回归。
- **未能离线验证**：ggplot 图像输出与 `injecting` 提示需要联网加载 R 包，已写入 [docs/verification.md](../../docs/verification.md) 人工验收第 5 节。

## 关联

- [../../AGENTS.md](../../AGENTS.md) 验证快照与活跃坑
- [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) 防错清单
- [2026-09-11-r-workbench-docked-panel.md](2026-09-11-r-workbench-docked-panel.md)、[2026-09-11-unified-run-contract-and-workspace-persistence.md](2026-09-11-unified-run-contract-and-workspace-persistence.md)
