# 决策：WebR 黑盒统计引擎（2026-09-03）

已实施：蓝图阶段 3 最小可行版已落地（`r-stats.ts` + `WebRClient.runStats` + InsightCard 统计区块）

## 问题

通用 Text2SQL 只能算 Sum/Count/Avg，答不了「是否显著」。原 P2 方向是「AI 生成 R 代码给用户运行」——把 R 暴露给业务用户与代码审计风险并存，且依赖真实使用反馈（阻塞）。蓝图升维为「AI 提议 → 平台静默执行 → 业务语言结论」。

## 决策

- `src/lib/r-stats.ts` 纯函数：`buildStatTestCode`（固定模板，R base stats 包，无额外安装）/ `parseStatTestOutput`（机器可读行 `P_VALUE=|STAT=|DF=|N=`）/ `summarizeStatTest`（p<0.05 阈值 → 「存在显著差异/相关/关联」业务语言）
- `WebRClient.runStats(code)`：黑盒执行，不写入工作台输出区/状态，仅返回 stdout（`withAutoprint: false`，不 echo 向量）
- `InsightItem.statTest`（nullable schema，strict 兼容）：`{ kind: ttest|cor|chisq, x, y, hypothesis }`，x/y 引用 querySpec 输出别名；AI 不写任何 R 代码
- InsightCard：statTest + result 就绪时自动 init WebR 并执行，结论展示在卡片「统计检验」区块；失败（R 未就绪/列缺失）卡片内提示，不影响读卡
- 采样上限 `STAT_SAMPLE_ROWS = 1000` 行，防止大结果集拖慢 WebR

## 替代方案（强制）

- AI 直接生成 R 代码（原 P2）：业务用户暴露代码 + 任意代码执行面；受使用反馈阻塞，否决
- 服务端 Python/Node 统计：引入服务端统计运行时依赖，违背「零云端算力成本、数据不出本地」，否决
- 前端 TS 实现统计：t.test/cor.test 手工实现易错且无 R 生态，否决

## 影响

- `ai-contract.ts` 双变体新增 `statTest`（AI 必须输出 null 或对象）；旧客户端解析容错（未解析 → undefined，静默降级）
- WebR 未初始化时统计自动尝试 init（CDN 失败 → 卡片内 warning 提示，统计不可用但不阻塞主链路）
- 契约红线遵守：`sessionReducer`/`useSession`/`types/session.ts` 未动；数据仍单向（result → 统计模板）