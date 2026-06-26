# AI 集成文档

## 一、架构

```text
用户输入 (自然语言)
    ↓
API Layer (/api/ai)
    ↓
Schema Service (提供数据库结构上下文)
    ↓
AI Service (OpenAI Compatible SDK)
    ↓
检测请求类型:
    ├─ 普通请求 → SQL 生成 + 解释
    └─ 洞察请求 → 结构化洞察推荐
    ↓
前端执行 SQL + 可视化
```

---

## 二、AI Service

### 文件

`src/lib/ai-service.ts`

### 接口

```typescript
// 普通 SQL 生成
generateSQL(
  message: string,           // 用户输入
  schemaContext: string,     // Schema 上下文
  conversationHistory?: {    // 多轮对话历史
    role: 'user' | 'assistant'
    content: string
  }[]
): Promise<{
  sql: string
  explanation: string
  insights?: InsightItem[]   // 洞察请求时返回
}>

// 洞察推荐
generateInsights(
  message: string,
  schemaContext: string
): Promise<InsightItem[]>
```

### 洞察请求检测

关键词匹配:
- 洞察
- 分析推荐
- 有什么数据
- 帮我分析
- 数据洞察
- 分析机会
- 推荐分析

### 模型配置

通过环境变量配置:

| 变量 | 说明 |
| :--- | :--- |
| `AI_API_BASE` | API 地址 |
| `AI_API_KEY` | API Key |
| `AI_MODEL` | 模型名称 (默认 mimo-v2.5-pro) |

支持任何 OpenAI 兼容 API (GPT-4o, Claude, DeepSeek, MiMo 等)。

---

## 三、提示词设计

### 普通 SQL 生成 Prompt

1. **角色定义** - 你是 PostgreSQL SQL 专家
2. **Schema 说明** - 星型模型结构 (维度表 + 事实表)
3. **业务指标公式** - 销售额、客单价、复购率等
4. **SQL 生成规则** - 只生成 SELECT、使用 JOIN
5. **图表数据建议** - 为每种图表类型提供数据格式建议
6. **输出格式** - 说明文字 + SQL (不要代码块)

### 洞察推荐 Prompt

1. **角色定义** - 数据分析助手
2. **Schema 说明** - 完整表结构和字段
3. **业务指标** - 销售额、订单数、客单价、退款率、复购率
4. **图表映射规则** - 严格的 JSON 格式规范
5. **输出格式** - JSON 数组，每条包含 title/insight/sql/chart

### Schema 上下文

由 `buildSchemaContext()` 生成，包含:

- 表结构 (表名、字段、类型、注释)
- 表关联 (外键关系)
- 星型模型业务说明
- 常用 JOIN 模式
- 分析示例

---

## 四、洞察输出格式

### JSON 规范

```json
[
  {
    "title": "各门店销售额排名",
    "insight": "旗舰店销量领先，但医院店客单价更高",
    "sql": "SELECT p.name AS name, SUM(o.pay_amount) AS value FROM fact_orders o JOIN dim_pharmacy p ON o.pharmacy_id = p.id GROUP BY p.name ORDER BY value DESC",
    "chart": {
      "type": "bar",
      "mapping": { "x": "name", "y": "value" }
    }
  }
]
```

### 图表映射规则

| type | mapping key | 说明 |
| --- | --- | --- |
| line | x, y | x=分类/时间列, y=数值列 |
| bar | x, y | x=分类列, y=数值列 |
| pie | name, value | name=分类列, value=数值列 |
| scatter | x, y | x=数值列, y=数值列 |
| boxplot | category, value | category=分类列, value=数值列 |
| table | 无 | 直接显示数据 |
| correlation | 无 | 自动计算相关系数 |

---

## 五、SQL 提取

从 AI 返回的文本中提取 SQL:

1. 尝试匹配 ` ```sql ... ``` ` 代码块
2. 逐行检测 SQL 关键字 (SELECT/WITH/EXPLAIN)
3. 兜底: 将整个文本作为 SQL

---

## 六、多轮对话

前端维护消息历史，每次请求携带最近 10 条对话记录。AI 根据上下文生成更准确的 SQL。

---

*文档版本: v1.22.0*
*最后更新: 2026-06-26*
