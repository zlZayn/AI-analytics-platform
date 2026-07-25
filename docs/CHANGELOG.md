# 变更日志

## [1.24.0] - 2026-07-25

### 数据分析工作台完整重构

- 查询执行统一为 PostgreSQL 只读事务，支持 statement timeout、底层取消、5,000 行硬上限、截断元数据和安全失败历史。
- 连接池增加容量、闲置/LRU 回收与配置失效；Schema 快照保证每个连接只有一个 active 版本。
- API 和客户端请求统一成功/失败合同、requestId、超时、取消、非 JSON 与竞态处理。
- 图表重构为画像、推荐、映射校验、确定性变换和渲染五层管线，支持表格、KPI、折线、柱状、饼图、散点、直方图、箱线图、热力图和相关矩阵。
- 工作台、探索页和查询页完成响应式布局、移动抽屉、结果表窗口化、键盘交互和专业亮色令牌统一；移除不稳定的暗色主题。
- AI 提示词改为领域中立并注入当前 Schema；strict JSON Schema 和本地合同阻止非法 SQL、未知图表与错误列映射；自动测试只使用 fake provider。
- 安全收尾移除仓库内硬编码凭据和旧真实 API 脚本；新连接密文采用每条随机盐并兼容旧三段格式；种子脚本只接受独立 `SEED_DATABASE_URL`。
- 测试基线升级为 Vitest 20 文件 / 59 项，并加入四视口 UI 烟测和全部 10 种图表离线 E2E。

### 升级要求

- 必须设置至少 32 字符的稳定 `ENCRYPTION_KEY`；从公开默认密钥旧版本升级时，轮换外部数据库密码并重新录入连接。
- 真实 AI provider 必须显式设置 `AI_API_BASE`、`AI_API_KEY` 和 `AI_MODEL`。
- Git 历史中曾出现的 AI token 与数据库密码必须在外部系统撤销并轮换；删除当前文件不能使历史凭据失效。

---

## [1.23.0] - 2026-06-26

### 连接选择 UI 重构

#### 侧边栏连接选择器

- 静态连接显示改为可点击下拉菜单
- 下拉显示所有连接列表，当前连接带 ✓ 标记
- 点击即切换连接，无需跳转页面
- 底部提供「管理连接」和「新建连接」快捷入口
- 无连接时显示「选择连接」占位按钮

#### 首页简化

- 点击连接行即可进入工作台（不再需要专门点「进入」按钮）
- 支持 `?action=create` 参数自动弹出新建对话框
- 空状态更清晰，引导用户创建第一个连接

#### 交互一致性修复

- Button 组件统一添加 `cursor-pointer`
- TabsTrigger 添加 `cursor-pointer`
- SelectTrigger 添加 `cursor-pointer`
- 所有可点击元素鼠标悬浮时显示手型指针

---

## [1.22.0] - 2026-06-26

### AI 洞察推荐

#### 新功能

- AI 助手自动识别洞察请求 (关键词: 洞察/分析推荐/有什么数据)
- 洞察卡片直接显示在聊天记录中
- 每条卡片包含: 标题 + 洞察说明 + SQL + 图表推荐
- 点击「执行」自动运行 SQL 并设置图表类型和列映射
- 图表类型和列映射根据 AI 推荐自动配置

#### AI 输出规范

- 统一 JSON 格式输出
- 图表映射规则: line/bar(x,y), pie(name,value), scatter(x,y), boxplot(category,value)
- SQL 列名使用 AS 别名，图表自动匹配

#### Seed 数据 v4

- 真实中文姓名 (常用姓+名组合)
- 会员类型: 慢性病/家庭/年轻/老年/随机
- 门店差异化: 旗舰店1.5x/社区店1x/医院店处方多
- 慢性病复购模式: 每月固定购药
- 数据量: 1200会员, 25000+订单, 15000+行为

#### 移除限制

- 移除自动 LIMIT 限制，用户自己控制查询行数
- SQL 校验器不再自动添加 LIMIT

### 图表系统重构

#### 核心原则

- 图表只负责接收数据并绘制，不做复杂推断
- 复杂计算交给 SQL 或 utils.ts 中的固定算法
- 用户完全控制列到轴的映射

#### 类型统一

- 统一 ChartType 定义: 只在 `variable-types.ts` 定义一次 (8 种)
- 删除 `charts/types.ts` 中的重复定义，改为从 `variable-types.ts` 导入

#### 算法修复

- Spearman 秩相关: 修复并列值处理，使用平均秩
- Kendall tau-b: 修复分母计算，正确处理并列值
- 相关矩阵: 修复 NaN 过滤，联合过滤保持行对齐

#### 交互优化

- 工作台: 查询后自动收起 SQL 编辑器，可视化区域更大
- 分组列选择: 唯一值 >20 时弹窗确认，先判断再更新
- 图例开关: 所有图表类型可切换显示/隐藏图例
- 柱状图: 分组>3自动堆叠，动态柱子宽度，X轴标签防重叠
- 列名使用 AS 别名，图表自动作为轴标签
- 列名使用 AS 别名，图表自动作为轴标签

#### Bug 修复

- 修复复制 SQL 按钮传递空字符串
- 修复 Explorer 页面 SchemaRelation.type 不存在
- 修复 EmptyState 组件支持自定义消息
- 删除 `.next` 构建缓存中的过期类型声明

---

## [1.20.0] - 2026-06-25

### UI 打磨 + 可视化简化

#### 图表系统简化

- 去掉直方图 (和柱状图重复)，保留 7 种图表
- 简化变量映射: 去掉角色推断过滤，所有列都可选
- inferMapping 直接用列名填充，不过滤类型
- 饼图修复: 按分类 GROUP BY 聚合
- 图表类型图标: emoji 替换为 lucide-react SVG
- 自定义 DropdownSelect: Vercel 风格，替代 base-ui Select

#### UI 统一

- Vercel 风格 CSS 变量 (hex)
- ChartConfigPanel: 简化为类型选择 + 列选择 + 图表渲染
- ResultPanel: 状态栏等宽字体 + 复制按钮带反馈
- 所有按钮: cursor-pointer + hover 变色

#### 跨页面联动

- Explorer "在工作台执行" → 跳转 workspace 预填 SQL
- 查询管理 "执行" → 跳转 workspace 预填 SQL
- AI 生成 SQL → 自动填入左侧编辑器

#### Bug 修复

- 修复 AI 输出重复 SQL (提示词 + 代码双重修复)
- 修复 Explorer 关联显示为空 (SchemaRelation 类型不匹配)
- 修复保存查询无法删除 (API 缺少 DELETE 处理器)
- 修复饼图每行一个扇区 (需 GROUP BY 聚合)

---

## [1.19.0] - 2026-06-25

### 页面重构 + 职责清晰化

#### 页面结构调整

- **数据工作台** `/workspace` - SQL 编辑器 + AI 助手左右分栏
- **数据探索** `/explorer` - Schema 浏览 (表结构/关联/预览)
- **查询管理** `/queries` - 收藏查询 + 执行历史合并
- 删除冗余页面: `/dashboard`, `/ai`, `/queries/history`, `/queries/saved`

#### 跨页面联动

- Explorer 预览 → 点击"在工作台执行" → 跳转 workspace 并预填 SQL
- 查询管理 → 点击"执行" → 跳转 workspace 并预填 SQL
- AI 生成 SQL → 自动填入左侧编辑器

#### 代码重构

- 提取共享类型 `src/types/index.ts`
- 清理未使用依赖 (zustand, react-query, zod)
- Vercel 风格 CSS 变量 (hex 替代 oklch)
- 删除冗余组件 (ai-tab, schema-tab, history-tab, sql-editor)

#### Bug 修复

- 修复 Explorer 页面 Table 类型未定义错误
- 修复 Explorer 页面 Fragment 未闭合错误
- 修复 DialogTrigger 嵌套 button 警告
- 修复 package.json 尾逗号错误

---

## [1.18.0] - 2026-06-22

### 模拟数据生成器 v3 (星型模型)

#### 数据模型重构

从平铺表重构为星型架构:

维度表 (dim_):

- `dim_date` -- 日期维度 (年/季/月/周/节假日/周末)
- `dim_member` -- 会员 (注册日/首购日/最后活跃日/细分标签/活跃状态)
- `dim_product` -- 商品 (一级分类/二级分类/品牌/规格/剂型/是否处方药)
- `dim_pharmacy` -- 门店 (城市/区域/门店类型/开业日期)
- `dim_promotion` -- 促销活动
- `dim_payment` -- 支付方式 (微信/支付宝/现金/银行卡)

事实表 (fact_):

- `fact_orders` -- 订单行级事实 (每件商品一行，含退款标记)
- `fact_behavior` -- 用户行为 (含 session_id/来源渠道/来源)
- `fact_inventory` -- 库存变动
- `fact_refunds` -- 退款记录

#### 数据分布改进

- Zipf 分布生成商品权重 (80/20 法则)
- 节假日脉冲 (2.5x) + 周末 (1.3x) + 发薪日 (1.2x)
- 动态会员升级 (累计消费驱动等级变化)
- 会员细分: high_value / loyal / new / churned / regular
- 退款率 ~8%
- 行为来源: direct / search / ad / recommend / share

#### 数据量

| 表 | 行数 |
| :--- | ---: |
| dim_date | 579 |
| dim_member | 800 |
| dim_product | 64 |
| dim_pharmacy | 10 |
| dim_promotion | 5 |
| dim_payment | 4 |
| fact_orders | ~9400 |
| fact_behavior | 10000 |
| fact_inventory | 800 |
| fact_refunds | ~750 |

#### Schema 清理 (v1.18.1)

- `fact_orders`: 移除冗余字段 `total_amount`(=quantity*unit_price)、`points_used`、`refund_flag`、`refund_amount`、`order_datetime`
- `fact_behavior`: 移除合成字段 `session_id`
- `fact_inventory`: 移除冗余字段 `before_stock`、`after_stock`(=before+quantity)、`order_id`
- 所有字段遵循整洁数据原则: 每行一个观测，无派生冗余

#### Schema 扫描过滤

- Schema 扫描自动排除 11 张平台元数据表 (users, connections, dashboard_widgets 等)
- 用户连接后只看到业务数据表 (dim_/fact_)

#### 饼图简化

- 移除"其他"合并逻辑，直接渲染用户查询结果
- 用户通过 SQL LIMIT 控制行数，饼图原样展示
- nameKey 值强制转 String，修复 boolean false 导致的 DOM 属性错误

#### 变量选择优化

- 下拉框显示样本值 (前 4 个)，用户选变量时能看到实际数据内容

#### AI 提示词优化

系统提示词增加星型模型上下文:

- 事实表/维度表分类说明
- 常用 JOIN 模式 (订单+商品、订单+门店、订单+会员、行为+商品)
- 业务指标公式 (销售额、客单价、退款率、复购率)
- 行为转化漏斗 (view -> favorite -> cart -> purchase)

Schema 上下文增加:

- 每张表的业务含义和关键字段说明
- 5 个常用分析 SQL 示例

#### 数据库连接信息

- 主机: localhost
- 端口: 5432
- 数据库名: ai_analytics
- 用户名: 使用专用种子账号
- 密码: 通过环境变量提供，禁止写入仓库

---

## [1.17.0] - 2026-06-22

### 图表组件模块化重构

#### 目录结构

```text
src/components/charts/
  index.tsx              # 主分发组件
  types.ts               # ChartType, ChartMapping, ChartProps, BoxStats
  constants.ts           # COLORS, AXIS_CONFIG, GRID_CONFIG, MAX_*
  utils.ts               # formatNumber, getColor, computeBins, computeBoxStats, computeCorrelation
  empty-state.tsx        # 空状态组件
  error-boundary.tsx     # ChartErrorBoundary
  hooks/
    use-grouped-data.ts  # Map 索引分组 (O(n))
    use-container-width.ts  # ResizeObserver 响应式宽度
  views/
    line-chart.tsx
    bar-chart.tsx
    pie-chart.tsx
    scatter-chart.tsx
    histogram.tsx
    box-plot.tsx
    heatmap.tsx
    correlation-heatmap.tsx
    table-view.tsx
```

#### 改进

- 单文件 967 行拆分为 14 个模块，职责清晰
- `ChartErrorBoundary`: 每个图表视图独立错误边界，渲染失败不导致白屏
- `useGroupedData`: 使用 Map 索引替代 `data.find`，O(n) 替代 O(n^2)
- `HeatmapView`: 同样使用 Map 索引优化查找
- `ChartType` 强类型联合: `"line" | "bar" | "pie" | "scatter" | "histogram" | "boxplot" | "heatmap" | "correlation" | "table"`
- `chart.tsx` 变为 re-export，现有 import 路径无需修改

#### UI 修复

- 相关系数矩阵 x 轴标签旋转后左对齐，避免被容器裁切
- 图表容器添加 `p-3` 内边距，替代 `overflow-hidden`，允许旋转标签正常显示

#### 映射槽位优化 (ggplot2 哲学)

- 折线图 X 轴接受分类/时间/二元变量，不再仅限时间字段
- 连续变量唯一值 <= 20 时也可用于分类槽位（颜色、填充、分组等）
- 下拉框中显示 `"(N值)"` 提示，说明该连续变量可作为分类使用
- 符合 ggplot2 设计：变量角色由数据分布决定，非强制锁定

---

## [1.16.0] - 2026-06-22

### 图表组件全面优化

#### 性能优化

- 所有图表子组件使用 `React.memo` 包裹，避免父组件更新导致无谓重绘
- 数据预处理逻辑全部迁移到 `useMemo`，不再在每次渲染时重建
- 抽取 `useGroupedData` 自定义 Hook，复用分组转换逻辑（LineChart/BarChart 共用）
- 抽取 `useContainerWidth` Hook，基于 `ResizeObserver` 实现响应式宽度

#### 类型安全

- `Chart` 主组件在渲染前校验必要字段（`validateMapping`），缺失时显示友好提示
- `TooltipFormatter` 统一处理 Recharts 的 `NameType` 兼容性
- `PieChartView` 的 `label` 回调处理 `name`/`percent` 可选类型

#### 直方图重写

- 数值型数据使用 Freedman-Diaconis 规则自动分箱，替代旧版简单计数
- 支持分组直方图（按 `fill` 字段分组，堆叠显示）
- 分类型数据回退到频次柱状图

#### 箱线图响应式

- SVG 基于 `ResizeObserver` 动态调整宽度，不再固定 500px
- 容器宽度变化时自动重绘

#### 数据截断警告

- 热力图超过 20 个唯一值时显示黄色警告提示
- 相关系数热力图超过 10 列时显示警告
- 表格超过 100 行时显示截断提示

#### 饼图优化

- 超过 8 项时自动合并尾部为"其他"，避免饼图过于拥挤

#### 数值格式化

- 新增 `formatNumber` 工具函数，支持千位分隔符、M/K 缩写
- Tooltip 和坐标轴统一使用格式化输出
- 表格中的数值自动格式化

#### 公共常量

- `AXIS_CONFIG`: 统一坐标轴样式（字体、颜色、网格线）
- `COLORS`: 扩展到 12 色调色板
- `getColor(index)`: 统一颜色循环逻辑

---

## [1.15.0] - 2026-06-22

### 箱线图重写

#### 问题

- 旧版箱线图只是用柱状图显示均值，和普通柱状图一样

#### 解决方案

- 使用 SVG 重写箱线图
- 显示真实的统计量：
  - 箱体：Q1-Q3（四分位距）
  - 中位数线
  - 须线：1.5×IQR 范围
  - 异常值点
- 添加图例说明
- 支持多组对比

---

## [1.14.0] - 2026-06-22

### 数值型变量识别修复

#### 问题描述

- 数值型变量（如 `SUM()` 结果）唯一值少时被错误识别为 `categorical`
- 导致饼图等图表无法正确映射

#### 修复方案

- 数值型变量（数据库类型为 numeric/int/float 等）直接返回 `continuous`
- 不再根据唯一值数量判断数值型变量是否是分类变量
- 只有布尔类型（0/1）才返回 `binary`

---

## [1.13.0] - 2026-06-22

### UI 改进

#### 图表类型选择

- 移除图表类型可用性限制
- 所有图表类型都可自由选择
- 不再根据变量类型强制锁定

#### 变量信息卡片

- 显示完整的描述性统计
- 数值型：范围、均值、唯一值数
- 分类型：唯一值数、空值比例、样本值
- 时间型：唯一值数、样本值
- 每个变量显示原始数据库类型

---

## [1.12.0] - 2026-06-22

### 字符串数值检测

#### 类型识别问题

- PostgreSQL `pg` 库返回的列类型可能是 `varchar`，但实际值是数值
- 导致变量被推断为 `categorical`，图表类型只能选表格

#### 检测修复

- `inferVariableRole()` 增加值内容检测
- 如果字符串类型中 80% 以上是数值形式，视为 `continuous`
- 确保聚合函数（SUM、AVG 等）的结果能被正确识别为数值

---

## [1.11.0] - 2026-06-22

### 数据库重新设计

#### 新增表

- `inventory_logs` - 库存变动记录（采购/销售/退货/调整）
- `promotions` - 促销活动表

#### 字段扩展

- `products.is_hot` - 是否热门商品
- `members.total_spend` - 累计消费额
- `members.order_count` - 订单数量
- `members.last_order_date` - 最后订单日期
- `orders.points_earned` - 获得积分
- `orders.points_used` - 使用积分
- `orders.promotion_id` - 使用的促销

#### 数据真实性改进

- 季节性波动（感冒药冬春高，皮肤药夏秋高）
- 热门/冷门商品权重（80/20 法则）
- 活跃/沉默用户差异
- 会员等级分布（普通 58%，银卡 25%，金卡 11%，钻石 5%）
- 促销使用率（30%）

#### 数据量

| 表 | 数据量 |
| :--- | :--- |
| categories | 8 |
| products | 64 |
| pharmacies | 10 |
| members | 800 |
| orders | 2500 |
| order_items | 7191 |
| member_behaviors | 8000 |
| member_logins | 1500 |
| inventory_logs | 500 |
| promotions | 5 |

---

## [1.10.0] - 2026-06-22

### 映射逻辑修正

#### 图表类型映射规则

| 图表类型 | X 轴 | Y 轴 | 分组 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| 折线图 | temporal | continuous | categorical/binary | X 轴只接受时间字段 |
| 柱状图 | categorical/temporal/binary | continuous | categorical/binary | 分类对比 |
| 饼图 | - | - | - | name + value |
| 散点图 | continuous | continuous | categorical/binary | 两个数值变量 |
| 直方图 | continuous | - | categorical/binary | 单变量分布 |
| 箱线图 | categorical/binary | continuous | - | 分组统计 |
| 相关系数 | - | - | - | 自动提取数值变量 |

#### 映射修正

- `isChartTypeAvailable()` - 检查图表类型是否可用
- 图表类型按钮：不可用时置灰并提示原因
- 折线图 X 轴：不再接受 categorical，强制使用时间字段

---

## [1.9.0] - 2026-06-22

### 变量类型系统 v2

#### 重写内容

- `lib/variable-types.ts` 完全重写
- `components/chart-config-panel.tsx` 重写
- `components/chart.tsx` 类型优化

#### 变量统计信息

- `VariableStats` 接口
  - totalCount / nullCount / uniqueCount
  - nullRatio / uniqueRatio
  - sampleValues
  - min / max / mean（数值型）
  - isBoolean

#### 变量类型推断改进

- 布尔类型检测（true/false, 1/0, yes/no）
- 二值数值型检测（0/1）
- 动态阈值：唯一值 <= 20 或占比 <= 5% 且 <= 50

#### 变量 UI 改进

- 变量信息卡片：显示类型、值范围或唯一值数
- 映射槽位：显示变量类型标签
- 颜色区分：蓝色=时间，橙色=分类，绿色=数值，紫色=二值

---

## [1.8.0] - 2026-06-22

### 相关系数热力图

#### 新增图表类型

- 相关系数矩阵（correlation）
  - 自动提取所有数值变量
  - 计算两两相关系数
  - 颜色映射：蓝色=正相关，红色=负相关

#### 支持的统计量

| 方法 | 适用场景 |
| :--- | :--- |
| Pearson | 线性关系，对异常值敏感 |
| Spearman | 单调关系，基于秩次 |
| Kendall | 有序数据，小样本稳定 |

#### 实现

- `lib/variable-types.ts`：相关系数计算函数
  - `pearsonCorrelation()` - Pearson 相关系数
  - `spearmanCorrelation()` - Spearman 秩相关
  - `kendallCorrelation()` - Kendall tau-b
  - `correlationMatrix()` - 相关系数矩阵

#### UI

- 图表类型选择添加「相关矩阵」
- 选择相关矩阵后显示方法选择（Pearson/Spearman/Kendall）
- 热力图显示图例（负相关/无关/正相关）
- 悬浮显示精确数值

---

## [1.7.0] - 2026-06-22

### UI 打磨

#### 图表配置面板

- 图表类型选择改为网格布局，更宽敞
- 映射槽位改为响应式网格（2/4 列）
- 下拉框增大，显示变量类型标签和唯一值数量
- 变量信息面板：彩色标签区分类型

#### 图表样式

- 统一使用 320px 高度
- 网格线改为浅色 #f0f0f0
- 坐标轴隐藏刻度线，使用浅色轴线
- Tooltip 添加圆角边框
- 饼图改为环形图（innerRadius）
- 散点图添加透明度
- 柱状图去掉垂直网格线
- 直方图标签自动旋转避免重叠

#### 配色

- 蓝色系坐标轴文字 #6b7280
- 浅灰色网格 #f0f0f0
- 统一 Tooltip 样式

---

## [1.6.0] - 2026-06-22

### 变量类型系统（ggplot2 风格）

#### 新增模块

- `lib/variable-types.ts` - 变量类型推断系统
  - temporal（时间/日期）
  - categorical（分类，含唯一值少的数值）
  - continuous（连续数值）
  - id（唯一标识，不参与可视化）

#### 变量类型推断规则

- 时间/日期型 → temporal
- 数值型：唯一值 < 20 → categorical，否则 → continuous
- 字符串型 → categorical
- 布尔型 → categorical

#### 图表类型扩展

| 图表类型 | 映射槽位 |
| :--- | :--- |
| 折线图 | X轴 + Y轴 + 颜色(可选) + 分面(可选) |
| 柱状图 | X轴 + Y轴 + 填充(可选) + 分面(可选) |
| 饼图 | 分类 + 数值 |
| 散点图 | X轴 + Y轴 + 颜色(可选) + 大小(可选) + 分面(可选) |
| 直方图 | 变量 + 分组(可选) + 分面(可选) |
| 箱线图 | 分组 + 数值 + 填充(可选) |
| 热力图 | X轴 + Y轴 + 值 |

#### 映射槽位逻辑

- 每个槽位定义接受的变量类型
- 下拉选项根据槽位要求动态过滤
- 数值型变量唯一值少时可作为分类使用
- 任何变量都可作为分面（facet）维度

#### 变量信息面板

- 显示每个变量的类型和唯一值数量
- 帮助用户理解数据特征

---

## [1.5.0] - 2026-06-22

### 可视化入口

#### 新增入口

- 数据结构页：点击表名或「可视化」按钮，自动查询全表进入可视化
- 查询结果区：点击「进入可视化」按钮，基于当前结果进入可视化

#### 可视化模式

- 独立可视化面板，显示当前数据源名称
- 「退出可视化」按钮返回正常模式
- 可视化模式下隐藏 Tabs，专注图表配置

---

## [1.4.0] - 2026-06-22

### 图表配置系统（ggplot2 映射风格）

#### 新增组件

- `chart-config-panel.tsx` - 图表配置面板
  - 图表类型选择（折线/柱状/饼图/散点/表格）
  - X 轴字段选择（自动筛选可用列）
  - Y 轴字段选择（自动筛选可用列）
  - 分组字段选择（可选）

#### 图表映射逻辑

- 根据列类型自动分类（时间/分类/数值）
- 根据图表类型动态过滤可用映射
- 查询结果自动推断最佳映射
- 用户可手动调整任意映射

#### 映射规则

| 图表类型 | X 轴 | Y 轴 | 分组 |
| :--- | :--- | :--- | :--- |
| 折线图 | 时间/分类 | 数值 | 分类 |
| 柱状图 | 分类 | 数值 | 分类 |
| 饼图 | 分类 | 数值 | - |
| 散点图 | 数值 | 数值 | 分类 |
| 表格 | - | - | - |

#### Bug 修复

- 修复 SQL 验证器误判 `CREATED_AT` 为 `CREATE` 关键词的问题
  - 改用正则单词边界匹配 `\b`

---

## [1.3.0] - 2026-06-22

### Phase 2 完成

#### 新增功能

- 图表可视化（Recharts）
  - 折线图：时间趋势分析
  - 柱状图：分类对比分析
  - 饼图：占比分析
  - 自动推断图表类型
- 查询历史
  - 自动记录每次执行的 SQL
  - 支持点击复用历史查询
- 保存查询
  - 收藏常用 SQL
  - 自定义名称

#### 新增页面

- Dashboard 增加「查询历史」标签页
  - 左侧：保存的查询
  - 右侧：查询历史

#### 新增 API

- `GET /api/query/history` - 获取查询历史
- `POST /api/query/save` - 保存查询
- `GET /api/query/saved` - 获取保存的查询列表

#### UI 优化

- Monaco Editor 使用浅色主题
- 图表与表格并排显示
- 查询结果自动推荐图表类型

---

## [1.2.1] - 2026-06-22

### 修复

- 修复 `<button>` 嵌套 `<button>` 的 hydration 错误
- 修复 Prisma Schema version 字段超出 integer 范围的问题（改用 Unix 时间戳秒级）
- 修复创建连接时外键约束错误（需要先创建默认用户）
- 修复 `/api/query/saved` 路由命名错误（save → saved）
- 添加默认用户 seed 脚本

### 测试数据

- 创建测试数据库 testdb
- 生成 8 个分类、40 个商品、15 个药店
- 生成 500 个会员、2000 个订单、5905 条订单明细
- 生成 5000 条行为记录、1000 条登录记录

---

## [1.2.0] - 2026-06-22

### Phase 1 实现完成

#### 项目初始化

- Next.js 14 (App Router) + TypeScript + TailwindCSS
- Prisma 7.8.0 + PostgreSQL 适配器
- shadcn/ui 组件库
- Monaco Editor (SQL 编辑器)

#### 数据库

- 创建 ai_analytics 数据库
- 推送 Prisma Schema (11 张表)
- 生成 Prisma 客户端

#### 后端 API

- `POST /api/connections` - 创建连接
- `GET /api/connections` - 连接列表
- `GET /api/connections/[id]` - 连接详情
- `PUT /api/connections/[id]` - 更新连接
- `DELETE /api/connections/[id]` - 删除连接
- `GET /api/schema/[connectionId]` - 获取 Schema
- `POST /api/query` - 执行 SQL
- `POST /api/ai` - AI 分析

#### 前端页面

- 首页 - 连接管理界面
- Dashboard - SQL 编辑器 + AI 分析 + 数据结构浏览

#### 核心功能

- 数据库连接管理（CRUD + 测试连接）
- Schema 自动发现（表、字段、关系、注释）
- SQL 执行引擎（安全校验 + 超时控制）
- AI 生成 SQL（MiMo API 集成）
- 图表自动推断（折线/柱状/饼图/散点/表格）

#### 技术亮点

- Prisma 7 新版适配器模式
- SQL 白名单安全校验
- Schema JSON 缓存
- AI 响应解析容错

---

## [1.1.0] - 2026-06-22

### 架构优化

- **简化架构**：去掉过度设计的 Analysis Planner 和 SQL Builder
- **AI 直接生成 SQL**：AI 不再输出复杂的分析计划，直接生成可执行的 SQL
- **自动推断图表类型**：根据查询结果自动推断图表类型，不依赖 AI

### 文档更新

#### 01_project_overview.md

- 简化架构原则，去掉"AI 不直接操作数据库"的过度设计
- 更新系统架构图，去掉 Analysis Planner 和 SQL Builder
- 简化核心流程，从 9 步减少到 8 步
- 更新模块职责表，合并相关模块
- 更新设计亮点，强调简洁架构

#### 02_database_design.md

- query_history 表添加 result_summary 字段（查询结果摘要）
- dashboard_widgets 表添加 data_cache 和 last_refreshed_at 字段

#### 04_ai_integration.md

- 简化 AI 处理流程，从 7 步减少到 5 步
- 修改 System Prompt，让 AI 直接输出 SQL 而不是 JSON
- 删除 SQL Builder 章节（不再需要）
- 将 Visualization Engine 改为 Chart Inference（图表推断）
- 更新 AI 输出格式，从复杂 JSON 改为直接 SQL

#### 06_development_plan.md

- 调整开发计划从 4 周改为 6 周
- 合并 Phase 1 和 Phase 2，专注基础功能
- 合并 Phase 3 和 Phase 4，专注可视化和 AI
- 新增 Phase 3，专注仪表板和优化

#### 07_page_structure.md

- 精简页面从 9 个减少到 4 个 MVP 核心页面
- 更新侧边栏导航，去掉非核心功能

### 测试验证

- 使用 pharmacy_member 数据库测试 AI 生成 SQL 效果
- 5 个测试用例全部通过
- AI 能正确生成 JOIN、聚合、CASE WHEN 等复杂查询

---

## [1.0.0] - 2026-06-22

### 初始版本

- 项目概述文档
- 数据库设计文档（11 张表）
- API 设计文档
- AI 集成文档
- 模块设计文档
- 开发计划文档
- 页面结构文档

---

## 问题与修复

### 问题 1：架构过度设计

**问题**：设计了 Analysis Planner → SQL Builder → Validator → Query Engine 四层，但实际测试 AI 直接生成 SQL 就能用。

**修复**：简化为 AI → Validator → Query Engine，去掉 SQL Builder 和 Analysis Planner。

### 问题 2：AI 输出格式不合理

**问题**：要求 AI 输出复杂的 JSON（analysis_type, chart_config 等），但实际上 AI 可能会输出格式错误的内容。

**修复**：让 AI 直接输出 SQL，图表类型由系统根据查询结果自动推断。

### 问题 3：数据库设计缺少关键字段

**问题**：

- query_history 缺少 result_summary 字段
- dashboard_widgets 缺少 data_cache 字段

**修复**：补充缺失字段。

### 问题 4：页面设计过于复杂

**问题**：设计了 9 个页面，但 MVP 阶段可能不需要这么多。

**修复**：MVP 只保留 4 个核心页面。

### 问题 5：开发计划过于乐观

**问题**：4 周完成全部功能，但实际可能需要更长时间。

**修复**：调整为 6 周，分 3 个阶段。
