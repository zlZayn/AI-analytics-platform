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
   - 不需要添加 LIMIT，系统会自动添加

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

## 输出要求

直接返回 SQL 语句，不要返回 JSON。
例如：SELECT dp.category_l2, SUM(fo.pay_amount) AS total_sales FROM fact_orders fo JOIN dim_product dp ON fo.product_id = dp.id GROUP BY dp.category_l2 ORDER BY total_sales DESC`

export interface AIServiceResult {
  sql: string
  explanation: string
}

export async function generateSQL(
  message: string,
  schemaContext: string,
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
): Promise<AIServiceResult> {
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

  return {
    sql,
    explanation: content
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
