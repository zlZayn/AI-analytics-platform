# AI 集成设计文档

## 一、AI 服务配置

### API 配置

```typescript
const AI_CONFIG = {
  api_base: process.env.AI_API_BASE || "https://token-plan-cn.xiaomimimo.com/v1",
  api_key: process.env.AI_API_KEY || "",
  model: process.env.AI_MODEL || "mimo-v2.5-pro"
}
```

### SDK 选择

使用 OpenAI Compatible SDK，支持多种 AI 模型：

```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: AI_CONFIG.api_base,
  apiKey: AI_CONFIG.api_key
})
```

---

## 二、AI 处理流程

### 简化流程

```text
用户输入: "分析最近30天销售趋势"
          ↓
┌─────────────────────────────────────────┐
│ 1. Schema Context Builder              │
│    - 获取数据库结构                     │
│    - 压缩为 Prompt Context             │
└─────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────┐
│ 2. AI Service                          │
│    - 调用 AI API                        │
│    - 直接生成 SQL                       │
└─────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────┐
│ 3. SQL Validator                       │
│    - 安全检查                           │
│    - 自动添加 LIMIT                     │
└─────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────┐
│ 4. Query Engine                        │
│    - 执行 SQL                           │
│    - 返回结果                           │
└─────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────┐
│ 5. Chart Inference                     │
│    - 自动推断图表类型                   │
│    - 返回渲染参数                       │
└─────────────────────────────────────────┘
          ↓
返回给前端渲染
```

---

## 三、Schema Context Builder

### 职责

将数据库 Schema 压缩为 AI 可理解的文本格式，减少 Token 消耗。

### 实现

```typescript
interface SchemaContextBuilder {
  buildContext(schema: DatabaseSchema): string
  compressTables(tables: Table[]): string
  buildRelationsText(relations: Relation[]): string
}

class DefaultSchemaContextBuilder implements SchemaContextBuilder {
  
  buildContext(schema: DatabaseSchema): string {
    let context = '## 数据库结构\n\n'
    
    // 表概览
    context += '### 表列表\n'
    schema.tables.forEach(table => {
      context += `- ${table.name} (${table.comment || '无注释'})\n`
    })
    context += '\n'
    
    // 详细表结构（只给关键表）
    context += '### 表结构详情\n'
    schema.tables.slice(0, 20).forEach(table => {
      context += this.compressTable(table)
    })
    
    // 关系
    context += '\n### 表关系\n'
    context += this.buildRelationsText(schema.relations)
    
    return context
  }
  
  private compressTable(table: Table): string {
    let text = `\n#### ${table.name}\n`
    
    table.columns.forEach(col => {
      const parts = [col.name, col.type]
      if (col.is_primary) parts.push('PK')
      if (col.nullable === false) parts.push('NOT NULL')
      if (col.comment) parts.push(`-- ${col.comment}`)
      text += `- ${parts.join(' ')}\n`
    })
    
    return text
  }
  
  private buildRelationsText(relations: Relation[]): string {
    return relations.map(r => 
      `- ${r.from_table}.${r.from_column} -> ${r.to_table}.${r.to_column}`
    ).join('\n')
  }
}
```

### 输出示例

```text
## 数据库结构

### 表列表
- users (用户表)
- orders (订单表)
- products (商品表)
- categories (分类表)

### 表结构详情

#### orders
- id bigint PK
- user_id bigint NOT NULL -- 用户ID
- amount numeric(10,2) NOT NULL -- 订单金额
- status varchar(20) NOT NULL -- 状态: pending/paid/shipped/completed/cancelled
- created_at timestamp NOT NULL -- 创建时间

#### users
- id bigint PK
- username varchar(50) NOT NULL
- email varchar(100) NOT NULL
- created_at timestamp NOT NULL

### 表关系
- orders.user_id -> users.id
- products.category_id -> categories.id
```

---

## 四、Prompt 设计

### System Prompt

```typescript
const SYSTEM_PROMPT = `你是一个专业的数据分析助手。根据用户的自然语言需求，生成 PostgreSQL 查询。

## 数据库结构
${schemaContext}

## 规则

1. **SQL 安全性**
   - 只生成 SELECT 查询
   - 不生成 DROP, DELETE, UPDATE, ALTER, TRUNCATE
   - 不需要添加 LIMIT，系统会自动添加

2. **SQL 质量**
   - 使用标准 PostgreSQL 语法
   - 合理使用 JOIN
   - 适当使用聚合函数
   - 时间字段使用 date_trunc 进行粒度控制

3. **业务理解**
   - 理解常见业务指标（销售额、转化率、留存率等）
   - 自动识别时间维度、分类维度、数值指标

## 输出要求

直接返回 SQL 语句，不要返回 JSON。
例如：SELECT * FROM users WHERE created_at > NOW() - INTERVAL '30 days'`
```

### User Prompt 构建

```typescript
function buildUserPrompt(message: string, context?: ConversationContext): string {
  let prompt = message

  if (context?.previousResults) {
    prompt = `基于之前的查询结果，${message}`
  }

  if (context?.clarification) {
    prompt = `${context.clarification}\n\n用户选择: ${message}`
  }

  return prompt
}
```

---

## 五、AI Service

### 核心函数

```typescript
interface AIServiceResult {
  sql: string
  explanation: string
}

async function generateSQL(
  message: string,
  schemaContext: string,
  conversationContext?: ConversationContext
): Promise<AIServiceResult> {

  const response = await client.chat.completions.create({
    model: AI_CONFIG.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...buildConversationHistory(conversationContext),
      { role: 'user', content: buildUserPrompt(message, conversationContext) }
    ],
    temperature: 0.7,
    max_tokens: 2000
  })

  const content = response.choices[0].message.content

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
  let sqlLines: string[] = []
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
```

---

## 六、SQL Validator

### 安全规则

```typescript
class SQLValidator {
  
  private allowedKeywords = ['SELECT', 'WITH', 'EXPLAIN', 'ANALYZE']
  private forbiddenKeywords = [
    'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'INSERT', 'UPDATE',
    'CREATE', 'GRANT', 'REVOKE', 'EXECUTE', 'COPY'
  ]
  
  validate(sql: string): ValidationResult {
    const upperSQL = sql.toUpperCase().trim()
    
    // 检查是否以 SELECT 或 WITH 开头
    if (!this.allowedKeywords.some(kw => upperSQL.startsWith(kw))) {
      return {
        valid: false,
        error: '只允许 SELECT 查询'
      }
    }
    
    // 检查是否包含禁止的关键词
    for (const keyword of this.forbiddenKeywords) {
      if (upperSQL.includes(keyword)) {
        return {
          valid: false,
          error: `包含禁止的操作: ${keyword}`
        }
      }
    }
    
    // 检查是否有 LIMIT
    if (!upperSQL.includes('LIMIT')) {
      sql = `${sql} LIMIT 1000`
    }
    
    // 检查括号匹配
    const openCount = (sql.match(/\(/g) || []).length
    const closeCount = (sql.match(/\)/g) || []).length
    if (openCount !== closeCount) {
      return {
        valid: false,
        error: '括号不匹配'
      }
    }
    
    return {
      valid: true,
      sanitizedSQL: sql
    }
  }
}
```

---

## 七、Chart Inference（图表推断）

### 目标

根据查询结果自动推断图表类型，不需要 AI 参与。

### 推断规则

```typescript
interface ChartInferenceResult {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'table'
  title: string
  xAxis?: string
  yAxis?: string
  groupBy?: string
}

function inferChartType(
  columns: ColumnInfo[],
  rows: any[]
): ChartInferenceResult {

  // 识别列类型
  const timeColumns = columns.filter(c =>
    c.type.includes('time') || c.type.includes('date')
  )
  const numericColumns = columns.filter(c =>
    c.type.includes('int') || c.type.includes('numeric') || c.type.includes('float')
  )
  const textColumns = columns.filter(c =>
    c.type.includes('varchar') || c.type.includes('text')
  )

  // 规则 1: 有时间列 + 数值列 → 折线图
  if (timeColumns.length > 0 && numericColumns.length > 0) {
    return {
      type: 'line',
      title: '趋势分析',
      xAxis: timeColumns[0].name,
      yAxis: numericColumns[0].name,
      groupBy: textColumns[0]?.name
    }
  }

  // 规则 2: 有文本列 + 数值列，行数少 → 饼图
  if (textColumns.length > 0 && numericColumns.length > 0 && rows.length <= 10) {
    return {
      type: 'pie',
      title: '占比分析'
    }
  }

  // 规则 3: 有文本列 + 数值列 → 柱状图
  if (textColumns.length > 0 && numericColumns.length > 0) {
    return {
      type: 'bar',
      title: '分类对比',
      xAxis: textColumns[0].name,
      yAxis: numericColumns[0].name
    }
  }

  // 规则 4: 多个数值列 → 散点图
  if (numericColumns.length >= 2) {
    return {
      type: 'scatter',
      title: '分布分析',
      xAxis: numericColumns[0].name,
      yAxis: numericColumns[1].name
    }
  }

  // 默认: 表格
  return {
    type: 'table',
    title: '数据明细'
  }
}
```

---

## 八、多轮对话

### 对话上下文管理

```typescript
interface ConversationContext {
  conversationId: string
  messages: Message[]
  currentSchema?: DatabaseSchema
  lastResult?: QueryResult
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sql?: string
  chartConfig?: ChartConfig
}

class ConversationManager {
  
  private conversations: Map<string, ConversationContext>
  
  async processMessage(
    conversationId: string,
    userMessage: string,
    connectionId: string
  ): Promise<AnalysisResult> {
    
    // 获取或创建对话上下文
    let context = this.conversations.get(conversationId)
    if (!context) {
      context = {
        conversationId,
        messages: [],
        currentSchema: await this.loadSchema(connectionId)
      }
      this.conversations.set(conversationId, context)
    }
    
    // 添加用户消息
    context.messages.push({
      role: 'user',
      content: userMessage
    })
    
    // 调用 AI
    const result = await analyzeWithAI(
      userMessage,
      this.buildSchemaContext(context.currentSchema),
      context
    )
    
    // 添加助手消息
    context.messages.push({
      role: 'assistant',
      content: result.description,
      sql: result.sql,
      chartConfig: result.chart_config
    })
    
    return result
  }
  
  private buildSchemaContext(schema: DatabaseSchema): string {
    // 压缩 Schema 为文本
    const builder = new DefaultSchemaContextBuilder()
    return builder.buildContext(schema)
  }
}
```

---

## 十、错误处理

### AI 响应解析

```typescript
function parseAIResponse(response: string): AnalysisResult {
  try {
    const parsed = JSON.parse(response)
    
    // 验证必要字段
    if (!parsed.sql || !parsed.chart_config) {
      throw new Error('AI 响应缺少必要字段')
    }
    
    return parsed
  } catch (error) {
    // 尝试从文本中提取 SQL
    const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/)
    if (sqlMatch) {
      return {
        analysis_type: 'unknown',
        description: 'AI 生成的查询',
        sql: sqlMatch[1],
        chart_config: { type: 'table' },
        insights: [],
        followUp: []
      }
    }
    
    throw new Error('无法解析 AI 响应')
  }
}
```

### 重试机制

```typescript
async function callAIWithRetry(
  message: string,
  schemaContext: string,
  maxRetries = 3
): Promise<AnalysisResult> {
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await analyzeWithAI(message, schemaContext)
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  
  throw new Error('AI 调用失败')
}
```

---

## 十一、性能优化

### 1. Schema 缓存

```typescript
class SchemaCache {
  private cache: Map<string, { schema: DatabaseSchema, timestamp: number }>
  private ttl = 24 * 60 * 60 * 1000 // 24 小时
  
  async getSchema(connectionId: string): Promise<DatabaseSchema> {
    const cached = this.cache.get(connectionId)
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.schema
    }
    
    const schema = await this.fetchSchema(connectionId)
    this.cache.set(connectionId, { schema, timestamp: Date.now() })
    
    return schema
  }
}
```

### 2. 查询缓存

```typescript
class QueryCache {
  private cache: Map<string, { result: any, timestamp: number }>
  private ttl = 5 * 60 * 1000 // 5 分钟
  
  async executeWithCache(
    sql: string,
    executor: () => Promise<any>
  ): Promise<any> {
    const cacheKey = this.hashSQL(sql)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.result
    }
    
    const result = await executor()
    this.cache.set(cacheKey, { result, timestamp: Date.now() })
    
    return result
  }
  
  private hashSQL(sql: string): string {
    return crypto.createHash('md5').update(sql).digest('hex')
  }
}
```

### 3. Token 优化

```typescript
function optimizeTokenUsage(schema: DatabaseSchema): string {
  // 1. 只保留表名和关键字段
  // 2. 移除不必要的注释
  // 3. 使用缩写
  
  let context = ''
  
  schema.tables.forEach(table => {
    // 只给表名和主要字段
    const mainColumns = table.columns.filter(col => 
      col.is_primary || col.name.includes('id') || 
      col.name.includes('amount') || col.name.includes('date')
    )
    
    context += `${table.name}(${mainColumns.map(c => c.name).join(',')})\n`
  })
  
  return context
}
```

---

## 十二、监控与日志

### AI 调用日志

```typescript
interface AILogEntry {
  id: string
  userId: string
  connectionId: string
  message: string
  response: string
  tokenCount: number
  executionTimeMs: number
  success: boolean
  error?: string
  timestamp: Date
}

class AILogger {
  async log(entry: AILogEntry): Promise<void> {
    // 保存到数据库
    await prisma.aI_logs.create({ data: entry })
    
    // 如果是错误，发送告警
    if (!entry.success) {
      await this.sendAlert(entry)
    }
  }
}
```

---

*文档版本: v1.11.0*
*最后更新: 2026-06-22*
