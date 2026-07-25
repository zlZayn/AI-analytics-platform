# 模块设计

## 服务边界

| 模块 | 职责 |
| :--- | :--- |
| `query-engine.ts` | 只读事务、超时、取消、5,000 行边界和 PG 类型映射 |
| `pool-registry.ts` | 有限容量、创建去重、闲置/LRU 回收和连接池失效 |
| `schema-service.ts` | Schema 扫描、事务快照与 AI 上下文 |
| `api-response.ts` / `client-api.ts` | 统一服务端响应与客户端错误/取消处理 |
| `ai-contract.ts` / `ai-service.ts` | 领域中立提示词、structured output、运行时合同和 provider |
| `sql-validator.ts` | 单条 `SELECT/WITH` 保守预检；数据库只读事务是最终边界 |

## 图表五层管线

`profileData -> recommendCharts -> validateChartMapping -> transformForChart -> renderChart`。

- `types.ts` 是判别联合映射的单一类型源，不含字符串兜底或索引签名。
- `mapping.ts` 集中创建和更新合法槽位。
- `pipeline.ts` 扫描完整返回结果、提供可解释推荐和用户主动选择后的默认映射。
- `algorithms.ts` 保存箱线、直方和相关系数纯函数。
- `transform.ts` 保存散点抽样、饼图合并、分组序列和热力图变换。
- `correlation.worker.ts` 在 Web Worker 计算最多 20 列的相关矩阵，配置变化会终止旧 Worker。
- `views/` 只渲染变换结果和明确的过滤、采样、合并或错误提示。

支持 10 种基础视图：表格、KPI、折线、柱状、饼/环、散点、直方、箱线、热力和相关矩阵。

## UI 状态

工作台的查询和 AI 请求分别持有 AbortController，只有最新 controller 可以写结果或结束 loading。重新执行保留最后一次成功结果。探索预览只传 schema/table 标识符，并阻止旧响应覆盖新表。

表格使用固定行高窗口化，只挂载可见行与 overscan；列宽按列集合保存在 localStorage，支持拖拽、键盘调整、粘性表头、NULL 标记和键盘滚动。
