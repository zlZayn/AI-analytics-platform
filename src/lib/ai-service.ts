import OpenAI from 'openai'

const AI_CONFIG = {
  apiBase: process.env.AI_API_BASE || 'https://token-plan-cn.xiaomimimo.com/v1',
  apiKey: process.env.AI_API_KEY || '',
  model: process.env.AI_MODEL || 'mimo-v2.5-pro'
}

const client = new OpenAI({
  baseURL: AI_CONFIG.apiBase,
  apiKey: AI_CONFIG.apiKey
})

const SYSTEM_PROMPT = `你是一个专业的数据分析助手。根据用户的自然语言需求，生成 PostgreSQL 查询。

## 数据模型

这是一个药店会员系统的星型模型:
- 事实表: fact_orders (订单), fact_behavior (行为), fact_inventory (库存), fact_refunds (退款)
- 维度表: dim_member (会员), dim_product (商品), dim_pharmacy (门店), dim_date (日期), dim_promotion (促销), dim_payment (支付)

事实表通过 *_id 外键关联维度表。

## 规则

1. **SQL 安全性**
   - 只生成 SELECT 查询
   - 不生成 DROP, DELETE, UPDATE, ALTER, TRUNCATE

2. **SQL 质量**
   - 使用标准 PostgreSQL 语法
   - 合理使用 JOIN 关联事实表和维度表
   - 适当使用聚合函数 (SUM, COUNT, AVG, MAX, MIN)
   - 时间字段使用 date_trunc 进行粒度控制
   - 分组时 SELECT 的非聚合字段必须在 GROUP BY 中

3. **业务理解**
   - 销售额: SUM(fact_orders.pay_amount)
   - 订单数: COUNT(DISTINCT fact_orders.order_no)
   - 客单价: SUM(pay_amount) / COUNT(DISTINCT order_no)
   - 退款率: 退款数 / 订单数
   - 复购率: 有2+订单的会员数 / 总会员数
   - 行为转化: view -> favorite -> cart -> purchase 漏斗

## 图表数据建议

SQL 查询结果会直接用于图表绘制。为了让图表效果更好，建议:

1. **柱状图/折线图**: 返回 name + value 格式
   SELECT category AS name, SUM(amount) AS value FROM ... GROUP BY category

2. **饼图**: 返回 name + value 格式，分类数建议 <= 10
   SELECT category AS name, COUNT(*) AS value FROM ... GROUP BY category

3. **散点图**: 返回两个数值列
   SELECT col_a AS x, col_b AS y FROM ...

4. **箱线图**: 返回 category + value 格式，按分组聚合
   SELECT category, value FROM raw_data (或用 percentile_cont 计算统计量)

5. **热力图**: 返回 x + y + value 交叉表
   SELECT row_name AS x, col_name AS y, metric AS value FROM ...

6. **相关矩阵**: 返回多个数值列，系统自动计算相关系数
   SELECT col1, col2, col3 FROM ...

7. **表格**: 直接返回原始数据即可

列名使用有意义的英文别名 (AS)，图表会自动使用这些别名作为轴标签。

## 输出格式

严格按以下格式输出，不要添加任何额外内容:

1. 先写一行简短说明 (不超过 20 字)
2. 空一行
3. 写 SQL 语句 (不要用代码块包裹)

示例:
查询各分类销售额

SELECT dp.category_l2 AS name, SUM(fo.pay_amount) AS value
FROM fact_orders fo
JOIN dim_product dp ON fo.product_id = dp.id
GROUP BY dp.category_l2
ORDER BY value DESC`

export interface AIServiceResult {
  sql: string
  explanation: string
  insights?: InsightItem[]
}

// 检测是否是洞察类请求
function isInsightRequest(message: string): boolean {
  const keywords = ['洞察', '分析推荐', '有什么数据', '帮我分析', '数据洞察', '分析机会', '推荐分析', '有什么 insights']
  return keywords.some(kw => message.includes(kw))
}

export async function generateSQL(
  message: string,
  schemaContext: string,
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
): Promise<AIServiceResult> {
  // 如果是洞察请求，使用洞察提示词
  if (isInsightRequest(message)) {
    const insights = await generateInsights(message, schemaContext)
    return {
      sql: '',
      explanation: `已生成 ${insights.length} 条分析洞察，请查看下方卡片`,
      insights
    }
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\n' + schemaContext }
  ]

  // 添加对话历史
  if (conversationHistory) {
    conversationHistory.forEach(msg => {
      messages.push({ role: msg.role, content: msg.content })
    })
  }

  // 添加当前用户消息
  messages.push({ role: 'user', content: message })

  const response = await client.chat.completions.create({
    model: AI_CONFIG.model,
    messages,
    temperature: 0.7,
    max_tokens: 2000
  })

  const content = response.choices[0].message.content || ''

  // 提取 SQL
  const sql = extractSQL(content)

  // 提取解释 (去掉 SQL 部分)
  const explanation = extractExplanation(content, sql)

  return {
    sql,
    explanation
  }
}

function extractSQL(text: string): string {
  // 尝试从代码块中提取
  const codeBlockMatch = text.match(/```(?:sql)?\s*\n([\s\S]*?)\n```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  // 尝试直接提取 SQL（以 SELECT 或 WITH 开头）
  const lines = text.split('\n')
  const sqlLines: string[] = []
  let inSQL = false

  for (const line of lines) {
    const upperLine = line.trim().toUpperCase()
    if (upperLine.startsWith('SELECT') || upperLine.startsWith('WITH')) {
      inSQL = true
    }
    if (inSQL) {
      sqlLines.push(line)
    }
    if (inSQL && (upperLine.endsWith(';') || upperLine === '')) {
      break
    }
  }

  if (sqlLines.length > 0) {
    return sqlLines.join('\n').replace(/;$/, '').trim()
  }

  // 如果都没找到，返回整个文本
  return text.replace(/;$/, '').trim()
}

function extractExplanation(text: string, sql: string): string {
  // 去掉代码块
  let cleaned = text.replace(/```[\s\S]*?```/g, '').trim()
  // 去掉重复的 SQL 文本 (精确匹配或去掉分号后匹配)
  const sqlNoSemicolon = sql.replace(/;$/, '').trim()
  cleaned = cleaned
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      // 跳过空行
      if (!trimmed) return false
      // 跳过纯 SQL 行
      if (trimmed === sqlNoSemicolon || trimmed === sql.trim()) return false
      // 跳过 SQL 关键字开头的行 (SELECT, FROM, WHERE, GROUP, ORDER, JOIN, ON, AND, OR, SUM, COUNT, AS)
      const upper = trimmed.toUpperCase()
      if (/^(SELECT|FROM|WHERE|GROUP|ORDER|JOIN|ON|AND|OR|SUM|COUNT|AS|HAVING|LIMIT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/.test(upper)) return false
      return true
    })
    .join('\n')
    .trim()
  return cleaned || '已生成 SQL 查询'
}

// ============================================================================
// 洞察推荐
// ============================================================================

export interface InsightItem {
  title: string
  insight: string
  sql: string
  chart: {
    type: string
    mapping: Record<string, string>
  }
}

const INSIGHTS_PROMPT = `你是一个专业的数据分析助手。根据用户需求，生成多条有业务洞察的分析推荐。

## 数据模型

这是一个药店会员系统的星型模型:
- 事实表: fact_orders (订单), fact_behavior (行为), fact_inventory (库存), fact_refunds (退款)
- 维度表: dim_member (会员), dim_product (商品), dim_pharmacy (门店), dim_date (日期), dim_promotion (促销), dim_payment (支付)

## 业务指标

- 销售额: SUM(fact_orders.pay_amount)
- 订单数: COUNT(DISTINCT fact_orders.order_no)
- 客单价: SUM(pay_amount) / COUNT(DISTINCT order_no)
- 退款率: 退款数 / 订单数
- 复购率: 有2+订单的会员数 / 总会员数
- 行为转化: view -> favorite -> cart -> purchase 漏斗

## 输出要求

生成 5-8 条洞察，每条包含:
1. 标题 (简短，10字以内)
2. 业务洞察 (一句话说明发现)
3. SQL 查询 (可直接执行)
4. 推荐图表类型和列映射

## 图表类型和映射规则

严格按以下格式，mapping 中的 key 必须是 SQL 结果中的列别名 (AS 后面的名字):

图表类型: line, bar, pie, scatter, boxplot, table, correlation

映射规则:
- line/bar: x=分类列, y=数值列
- pie: name=分类列, value=数值列
- scatter: x=数值列, y=数值列
- boxplot: category=分类列, value=数值列
- table/correlation: 无需映射

示例:
{"title":"各门店销售额","insight":"旗舰店销量领先","sql":"SELECT p.name AS name, SUM(o.pay_amount) AS value FROM fact_orders o JOIN dim_pharmacy p ON o.pharmacy_id = p.id GROUP BY p.name ORDER BY value DESC","chart":{"type":"bar","mapping":{"x":"name","y":"value"}}}

## 输出格式

严格输出 JSON 数组，不要添加任何额外内容:

[{"title":"各门店销售额排名","insight":"旗舰店销量领先，但医院店客单价更高","sql":"SELECT p.name, SUM(o.pay_amount) as revenue FROM fact_orders o JOIN dim_pharmacy p ON o.pharmacy_id = p.id GROUP BY p.name ORDER BY revenue DESC","chart":{"type":"bar","mapping":{"x":"name","y":"revenue"}}},
  ...
]

只输出 JSON，不要有其他文字。`

export async function generateInsights(
  message: string,
  schemaContext: string,
): Promise<InsightItem[]> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: INSIGHTS_PROMPT + '\n\n' + schemaContext },
    { role: 'user', content: message }
  ]

  const response = await client.chat.completions.create({
    model: AI_CONFIG.model,
    messages,
    temperature: 0.7,
    max_tokens: 4000
  })

  const content = response.choices[0].message.content || ''

  // 提取 JSON
  try {
    // 尝试从代码块提取
    const codeBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
    const jsonStr = codeBlockMatch ? codeBlockMatch[1] : content

    // 找到 JSON 数组
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0])
    }
  } catch (e) {
    console.error('解析洞察 JSON 失败:', e)
  }

  return []
}
