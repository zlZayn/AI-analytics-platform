# 模块详细设计文档

## 一、模块总览

| 模块 | 职责 | 核心类/组件 |
| :--- | :--- | :--- |
| Connection Service | 数据库连接管理 | ConnectionService |
| Schema Service | Schema 发现与缓存 | SchemaService |
| Schema Context Builder | Schema 压缩供 AI 使用 | SchemaContextBuilder |
| AI Analysis Engine | AI 意图理解与分析 | AIAnalysisEngine |
| SQL Builder | SQL 生成 | SQLBuilder |
| SQL Validator | SQL 安全校验 | SQLValidator |
| Query Engine | SQL 执行 | QueryEngine |
| Visualization Engine | 图表配置生成 | VisualizationEngine |
| Dashboard Service | 仪表板管理 | DashboardService |
| Conversation Service | AI 对话管理 | ConversationService |

---

## 二、Connection Service

### Connection Service 职责

管理 PostgreSQL 数据库连接的生命周期。

### Connection Service 接口设计

```typescript
interface ConnectionService {
  // 创建连接
  create(userId: string, config: CreateConnectionDTO): Promise<Connection>
  
  // 获取连接列表
  list(userId: string, options?: ListOptions): Promise<PaginatedResult<Connection>>
  
  // 获取连接详情
  getById(id: string): Promise<Connection | null>
  
  // 更新连接
  update(id: string, config: UpdateConnectionDTO): Promise<Connection>
  
  // 删除连接
  delete(id: string): Promise<void>
  
  // 测试连接
  test(config: CreateConnectionDTO): Promise<TestResult>
  
  // 获取连接池
  getPool(id: string): Promise<Pool>
}
```

### Connection Service 数据结构

```typescript
interface Connection {
  id: string
  userId: string
  name: string
  description?: string
  host: string
  port: number
  database: string
  username: string
  passwordEncrypted: string
  ssl: boolean
  status: ConnectionStatus
  dbVersion?: string
  dbSize?: number
  tableCount?: number
  lastConnectedAt?: Date
  createdAt: Date
  updatedAt: Date
}

type ConnectionStatus = 'pending' | 'connected' | 'error' | 'disconnected'

interface CreateConnectionDTO {
  name: string
  description?: string
  host: string
  port?: number
  database: string
  username: string
  password: string
  ssl?: boolean
}

interface TestResult {
  success: boolean
  message: string
  latencyMs: number
  dbVersion?: string
}
```

### Connection Service 核心实现

```typescript
class ConnectionServiceImpl implements ConnectionService {
  
  private poolCache: Map<string, Pool>
  
  constructor(
    private prisma: PrismaClient,
    private encryption: EncryptionService
  ) {
    this.poolCache = new Map()
  }
  
  async create(userId: string, config: CreateConnectionDTO): Promise<Connection> {
    // 1. 加密密码
    const encryptedPassword = this.encryption.encrypt(config.password)
    
    // 2. 保存到数据库
    const connection = await this.prisma.connection.create({
      data: {
        userId,
        name: config.name,
        description: config.description,
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        username: config.username,
        passwordEncrypted: encryptedPassword,
        ssl: config.ssl || false,
        status: 'pending'
      }
    })
    
    // 3. 测试连接
    try {
      await this.testConnection(connection)
      await this.updateStatus(connection.id, 'connected')
    } catch (error) {
      await this.updateStatus(connection.id, 'error', error.message)
    }
    
    // 4. 触发 Schema 扫描
    await this.schemaService.scan(connection.id)
    
    return connection
  }
  
  async getPool(id: string): Promise<Pool> {
    // 检查缓存
    if (this.poolCache.has(id)) {
      return this.poolCache.get(id)!
    }
    
    // 获取连接配置
    const connection = await this.getById(id)
    if (!connection) {
      throw new Error('Connection not found')
    }
    
    // 解密密码
    const password = this.encryption.decrypt(connection.passwordEncrypted)
    
    // 创建连接池
    const pool = new Pool({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password,
      ssl: connection.ssl,
      max: 10,
      idleTimeoutMillis: 30000
    })
    
    // 缓存
    this.poolCache.set(id, pool)
    
    return pool
  }
  
  private async testConnection(connection: Connection): Promise<void> {
    const password = this.encryption.decrypt(connection.passwordEncrypted)
    
    const client = new Client({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password,
      ssl: connection.ssl
    })
    
    try {
      await client.connect()
      const result = await client.query('SELECT version()')
      // 更新版本信息
    } finally {
      await client.end()
    }
  }
}
```

### 加密服务

```typescript
class EncryptionService {
  private algorithm = 'aes-256-gcm'
  private key: Buffer
  
  constructor(secret: string) {
    this.key = crypto.scryptSync(secret, 'salt', 32)
  }
  
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }
  
  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
    
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}
```

---

## 三、Schema Service

### Schema Service 职责

自动发现和缓存数据库 Schema。

### Schema Service 接口设计

```typescript
interface SchemaService {
  // 获取 Schema
  getSchema(connectionId: string, refresh?: boolean): Promise<DatabaseSchema>
  
  // 获取表详情
  getTable(connectionId: string, tableName: string): Promise<Table>
  
  // 刷新 Schema
  refresh(connectionId: string): Promise<SchemaDiff>
  
  // 获取 ER 图数据
  getERDData(connectionId: string): Promise<ERDData>
}

interface DatabaseSchema {
  version: number
  scannedAt: Date
  tables: Table[]
  relations: Relation[]
}

interface Table {
  name: string
  schema: string
  comment?: string
  columns: Column[]
  indexes: Index[]
  rowEstimate: number
  totalSize: string
}

interface Column {
  name: string
  type: string
  nullable: boolean
  isPrimary: boolean
  defaultValue?: string
  comment?: string
}

interface Relation {
  name: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
}

interface SchemaDiff {
  version: number
  added: string[]
  removed: string[]
  modified: string[]
}
```

### Schema Service 核心实现

```typescript
class SchemaServiceImpl implements SchemaService {
  
  constructor(
    private prisma: PrismaClient,
    private connectionService: ConnectionService,
    private cache: SchemaCache
  ) {}
  
  async getSchema(connectionId: string, refresh = false): Promise<DatabaseSchema> {
    // 检查缓存
    if (!refresh) {
      const cached = await this.cache.get(connectionId)
      if (cached) return cached
    }
    
    // 从数据库扫描
    const schema = await this.scanSchema(connectionId)
    
    // 保存快照
    await this.saveSnapshot(connectionId, schema)
    
    // 缓存
    await this.cache.set(connectionId, schema)
    
    return schema
  }
  
  private async scanSchema(connectionId: string): Promise<DatabaseSchema> {
    const pool = await this.connectionService.getPool(connectionId)
    
    // 获取所有表
    const tablesResult = await pool.query(`
      SELECT 
        t.table_name,
        obj_description((quote_ident(t.table_name))::regclass) as table_comment,
        (SELECT COUNT(*) FROM information_schema.columns c 
         WHERE c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
      ORDER BY t.table_name
    `)
    
    const tables: Table[] = []
    
    for (const tableRow of tablesResult.rows) {
      // 获取列信息
      const columnsResult = await pool.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          col_description((quote_ident(c.table_name))::regclass, c.ordinal_position) as column_comment,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_name = $1
        ORDER BY c.ordinal_position
      `, [tableRow.table_name])
      
      // 获取索引
      const indexesResult = await pool.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = $1
      `, [tableRow.table_name])
      
      // 获取行数估计
      const statsResult = await pool.query(`
        SELECT reltuples::bigint as estimate
        FROM pg_class
        WHERE relname = $1
      `, [tableRow.table_name])
      
      tables.push({
        name: tableRow.table_name,
        schema: 'public',
        comment: tableRow.table_comment,
        columns: columnsResult.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          isPrimary: col.is_primary,
          defaultValue: col.column_default,
          comment: col.column_comment
        })),
        indexes: indexesResult.rows.map(idx => ({
          name: idx.indexname,
          definition: idx.indexdef
        })),
        rowEstimate: parseInt(statsResult.rows[0]?.estimate || '0'),
        totalSize: 'N/A'
      })
    }
    
    // 获取外键关系
    const relationsResult = await pool.query(`
      SELECT
        tc.constraint_name,
        tc.table_name as from_table,
        kcu.column_name as from_column,
        ccu.table_name as to_table,
        ccu.column_name as to_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
    `)
    
    const relations: Relation[] = relationsResult.rows.map(row => ({
      name: row.constraint_name,
      fromTable: row.from_table,
      fromColumn: row.from_column,
      toTable: row.to_table,
      toColumn: row.to_column,
      type: 'one-to-many'
    }))
    
    return {
      version: Date.now(),
      scannedAt: new Date(),
      tables,
      relations
    }
  }
  
  async getERDData(connectionId: string): Promise<ERDData> {
    const schema = await this.getSchema(connectionId)
    
    const nodes = schema.tables.map(table => ({
      id: table.name,
      label: table.name,
      columns: table.columns.slice(0, 5).map(c => c.name)
    }))
    
    const edges = schema.relations.map(rel => ({
      id: rel.name,
      from: rel.fromTable,
      to: rel.toTable,
      label: `${rel.fromColumn} -> ${rel.toColumn}`
    }))
    
    return { nodes, edges }
  }
}
```

---

## 四、Query Engine

### Query Engine 职责

统一执行 SQL 查询，提供安全控制和性能监控。

### Query Engine 接口设计

```typescript
interface QueryEngine {
  // 执行查询
  execute(connectionId: string, sql: string, options?: QueryOptions): Promise<QueryResult>
  
  // 执行计划
  explain(connectionId: string, sql: string): Promise<ExplainResult>
  
  // 取消查询
  cancel(queryId: string): Promise<void>
}

interface QueryOptions {
  limit?: number
  timeout?: number
  userId?: string
}

interface QueryResult {
  id: string
  columns: ColumnInfo[]
  rows: any[]
  rowCount: number
  executionTimeMs: number
  cached: boolean
}

interface ColumnInfo {
  name: string
  type: string
}

interface ExplainResult {
  plan: string
  analysis: string
  suggestions: string[]
}
```

### Query Engine 核心实现

```typescript
class QueryEngineImpl implements QueryEngine {
  
  private activeQueries: Map<string, { client: PoolClient, timeout: NodeJS.Timeout }>
  
  constructor(
    private connectionService: ConnectionService,
    private validator: SQLValidator,
    private cache: QueryCache,
    private historyService: QueryHistoryService
  ) {
    this.activeQueries = new Map()
  }
  
  async execute(
    connectionId: string,
    sql: string,
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const startTime = Date.now()
    const queryId = uuid()
    
    // 1. 验证 SQL
    const validation = this.validator.validate(sql)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
    
    // 2. 检查缓存
    const cached = await this.cache.get(sql)
    if (cached) {
      return { ...cached, id: queryId, cached: true }
    }
    
    // 3. 获取连接池
    const pool = await this.connectionService.getPool(connectionId)
    
    // 4. 执行查询（带超时）
    const limit = options.limit || 1000
    const timeout = options.timeout || 10000
    
    const limitedSQL = this.addLimit(validation.sanitizedSQL!, limit)
    
    try {
      const result = await this.executeWithTimeout(pool, limitedSQL, timeout)
      
      const queryResult: QueryResult = {
        id: queryId,
        columns: result.fields.map(f => ({
          name: f.name,
          type: this.mapPGType(f.dataTypeID)
        })),
        rows: result.rows,
        rowCount: result.rowCount,
        executionTimeMs: Date.now() - startTime,
        cached: false
      }
      
      // 5. 缓存结果
      await this.cache.set(sql, queryResult)
      
      // 6. 保存历史
      if (options.userId) {
        await this.historyService.save({
          userId: options.userId,
          connectionId,
          sql,
          status: 'success',
          executionTimeMs: queryResult.executionTimeMs,
          rowCount: queryResult.rowCount
        })
      }
      
      return queryResult
      
    } catch (error) {
      // 保存失败历史
      if (options.userId) {
        await this.historyService.save({
          userId: options.userId,
          connectionId,
          sql,
          status: error.message.includes('timeout') ? 'timeout' : 'error',
          executionTimeMs: Date.now() - startTime,
          errorMessage: error.message
        })
      }
      
      throw error
    }
  }
  
  private async executeWithTimeout(
    pool: Pool,
    sql: string,
    timeoutMs: number
  ): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      const client = pool.connect()
      const timer = setTimeout(() => {
        client.then(c => c.release())
        reject(new Error('Query timeout'))
      }, timeoutMs)
      
      client
        .then(c => c.query(sql))
        .then(result => {
          clearTimeout(timer)
          client.then(c => c.release())
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timer)
          client.then(c => c.release())
          reject(error)
        })
    })
  }
  
  private addLimit(sql: string, limit: number): string {
    const upperSQL = sql.toUpperCase().trim()
    if (upperSQL.includes('LIMIT')) {
      return sql
    }
    return `${sql} LIMIT ${limit}`
  }
  
  private mapPGType(oid: number): string {
    // PostgreSQL 类型映射
    const typeMap: Record<number, string> = {
      23: 'integer',
      20: 'bigint',
      21: 'smallint',
      1700: 'numeric',
      700: 'real',
      701: 'double precision',
      1043: 'varchar',
      25: 'text',
      16: 'boolean',
      1114: 'timestamp',
      1184: 'timestamptz',
      1082: 'date',
      1083: 'time'
    }
    return typeMap[oid] || 'unknown'
  }
  
  async explain(connectionId: string, sql: string): Promise<ExplainResult> {
    const pool = await this.connectionService.getPool(connectionId)
    
    const explainSQL = `EXPLAIN ${sql}`
    const result = await pool.query(explainSQL)
    
    const plan = result.rows.map(r => rQUERY PLAN).join('\n')
    
    // 分析执行计划
    const analysis = this.analyzeExplainResult(plan)
    
    return { plan, analysis, suggestions: [] }
  }
  
  private analyzeExplainResult(plan: string): string {
    if (plan.includes('Seq Scan')) {
      return '检测到全表扫描，建议添加索引'
    }
    if (plan.includes('Sort')) {
      return '检测到排序操作，建议添加索引优化'
    }
    return '查询计划正常'
  }
}
```

---

## 五、AI Analysis Engine

### AI Analysis Engine 职责

调用 AI API，理解用户需求，生成分析计划。

### AI Analysis Engine 接口设计

```typescript
interface AIAnalysisEngine {
  // 分析用户需求
  analyze(
    message: string,
    schemaContext: string,
    conversationContext?: ConversationContext
  ): Promise<AnalysisResult>
  
  // 生成 Follow-up 建议
  generateFollowUp(
    previousResult: AnalysisResult,
    schemaContext: string
  ): Promise<string[]>
}

interface AnalysisResult {
  analysisType: string
  description: string
  sql: string
  chartConfig: ChartConfig
  insights: string[]
  followUp: string[]
  clarification?: string
}

interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'table'
  title: string
  xAxis?: string
  yAxis?: string
  groupBy?: string
  options?: Record<string, any>
}
```

### AI Analysis Engine 核心实现

```typescript
class AIAnalysisEngineImpl implements AIAnalysisEngine {
  
  private openai: OpenAI
  
  constructor(config: AIConfig) {
    this.openai = new OpenAI({
      baseURL: config.apiBase,
      apiKey: config.apiKey
    })
  }
  
  async analyze(
    message: string,
    schemaContext: string,
    conversationContext?: ConversationContext
  ): Promise<AnalysisResult> {
    
    const messages = this.buildMessages(message, schemaContext, conversationContext)
    
    const response = await this.openai.chat.completions.create({
      model: AI_CONFIG.model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000
    })
    
    const content = response.choices[0].message.content
    return this.parseResponse(content)
  }
  
  private buildMessages(
    message: string,
    schemaContext: string,
    context?: ConversationContext
  ): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(schemaContext)
      }
    ]
    
    // 添加历史对话
    if (context?.messages) {
      context.messages.slice(-6).forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        })
      })
    }
    
    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: message
    })
    
    return messages
  }
  
  private buildSystemPrompt(schemaContext: string): string {
    return `你是一个专业的数据分析助手。

## 数据库结构
${schemaContext}

## 输出要求
请返回 JSON 格式，包含以下字段：
{
  "analysis_type": "趋势分析/分布分析/排名分析/对比分析/详情查看",
  "description": "简要描述分析内容",
  "sql": "SELECT 查询语句",
  "chart_config": {
    "type": "line/bar/pie/scatter/table",
    "title": "图表标题",
    "xAxis": "X轴字段",
    "yAxis": "Y轴字段",
    "groupBy": "分组字段（可选）"
  },
  "insights": ["洞察1", "洞察2"],
  "followUp": ["建议1", "建议2"]
}

## 规则
1. 只生成 SELECT 查询，不生成修改操作
2. 时间字段使用 date_trunc 控制粒度
3. 图表类型要匹配数据特征
4. 如果需求不明确，返回 clarification 字段而不是直接生成 SQL`
  }
  
  private parseResponse(content: string): AnalysisResult {
    try {
      const parsed = JSON.parse(content)
      
      // 验证必要字段
      if (!parsed.sql) {
        throw new Error('AI 响应缺少 SQL')
      }
      
      return {
        analysisType: parsed.analysis_type || 'unknown',
        description: parsed.description || '',
        sql: parsed.sql,
        chartConfig: parsed.chart_config || { type: 'table', title: '查询结果' },
        insights: parsed.insights || [],
        followUp: parsed.followUp || [],
        clarification: parsed.clarification
      }
    } catch (error) {
      throw new Error('AI 响应解析失败')
    }
  }
}
```

---

## 六、Dashboard Service

### Dashboard Service 职责

管理仪表板和组件。

### Dashboard Service 接口设计

```typescript
interface DashboardService {
  // 创建仪表板
  create(userId: string, config: CreateDashboardDTO): Promise<Dashboard>
  
  // 获取仪表板
  getById(id: string): Promise<DashboardWithWidgets | null>
  
  // 获取仪表板列表
  list(userId: string): Promise<Dashboard[]>
  
  // 更新仪表板
  update(id: string, config: UpdateDashboardDTO): Promise<Dashboard>
  
  // 删除仪表板
  delete(id: string): Promise<void>
  
  // 添加组件
  addWidget(dashboardId: string, widget: CreateWidgetDTO): Promise<Widget>
  
  // 更新组件
  updateWidget(dashboardId: string, widgetId: string, config: UpdateWidgetDTO): Promise<Widget>
  
  // 删除组件
  deleteWidget(dashboardId: string, widgetId: string): Promise<void>
  
  // 生成分享链接
  generateShareLink(dashboardId: string, expiresInDays?: number): Promise<ShareLink>
}

interface Dashboard {
  id: string
  userId: string
  name: string
  description?: string
  layout: LayoutItem[]
  isPublic: boolean
  shareToken?: string
  viewCount: number
  createdAt: Date
  updatedAt: Date
}

interface Widget {
  id: string
  dashboardId: string
  name: string
  type: 'chart' | 'metric' | 'table' | 'text' | 'filter'
  queryId?: string
  customSql?: string
  chartType?: string
  chartConfig?: ChartConfig
  positionX: number
  positionY: number
  width: number
  height: number
  title?: string
  showTitle: boolean
  createdAt: Date
  updatedAt: Date
}

interface LayoutItem {
  id: string
  x: number
  y: number
  w: number
  h: number
}
```

---

## 七、Conversation Service

### Conversation Service 职责

管理 AI 对话会话。

### Conversation Service 接口设计

```typescript
interface ConversationService {
  // 创建会话
  create(userId: string, connectionId?: string): Promise<Conversation>
  
  // 获取会话
  getById(id: string): Promise<ConversationWithMessages | null>
  
  // 获取会话列表
  list(userId: string): Promise<Conversation[]>
  
  // 添加消息
  addMessage(conversationId: string, message: CreateMessageDTO): Promise<Message>
  
  // 删除会话
  delete(id: string): Promise<void>
  
  // 归档会话
  archive(id: string): Promise<void>
}

interface Conversation {
  id: string
  userId: string
  connectionId?: string
  title?: string
  status: 'active' | 'archived'
  messageCount: number
  createdAt: Date
  updatedAt: Date
}

interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  generatedSql?: string
  executionResult?: any
  chartConfig?: ChartConfig
  tokenCount?: number
  executionTimeMs?: number
  createdAt: Date
}
```

---

## 八、变量类型系统

### 变量类型系统 职责

推断变量类型，支持 ggplot2 风格的映射系统。

### 变量类型

```typescript
type VariableRole =
  | "temporal"    // 时间/日期
  | "categorical" // 分类
  | "continuous"  // 连续数值
  | "binary"      // 二值
  | "id"          // 唯一标识
```

### 变量统计

```typescript
interface VariableStats {
  totalCount: number     // 总行数
  nullCount: number      // 空值数
  uniqueCount: number    // 唯一值数
  nullRatio: number      // 空值比例
  uniqueRatio: number    // 唯一值比例
  sampleValues: unknown[] // 样本值
  min?: number           // 最小值
  max?: number           // 最大值
  mean?: number          // 均值
  isBoolean?: boolean    // 是否布尔语义
}
```

### 推断规则

```typescript
inferVariableRole(colType, values) {
  // 时间/日期 → temporal
  // 布尔型 → binary
  // 数值型（0/1 二值）→ binary
  // 数值型（唯一值 <= 20 或占比 <= 5%）→ categorical
  // 数值型 → continuous
  // 字符串 → categorical
}
```

### 图表类型

```typescript
type ChartType =
  | "line"        // 折线图
  | "bar"         // 柱状图
  | "pie"         // 饼图
  | "scatter"     // 散点图
  | "histogram"   // 直方图
  | "boxplot"     // 箱线图
  | "correlation" // 相关系数矩阵
  | "table"       // 表格
```

### 映射槽位

```typescript
CHART_TYPE_SLOTS = {
  line:     { x: temporal/categorical, y: continuous, color: categorical/binary }
  bar:      { x: categorical/temporal, y: continuous, fill: categorical/binary }
  pie:      { name: categorical/binary, value: continuous }
  scatter:  { x: continuous, y: continuous, color: categorical/binary }
  histogram: { x: continuous, fill: categorical/binary }
  boxplot:  { x: categorical/binary, y: continuous }
  correlation: { 自动提取所有数值变量 }
}
```

### 相关系数计算

```typescript
// Pearson（线性关系）
pearsonCorrelation(x: number[], y: number[]): number

// Spearman（单调关系，基于秩次）
spearmanCorrelation(x: number[], y: number[]): number

// Kendall（有序数据，小样本稳定）
kendallCorrelation(x: number[], y: number[]): number

// 相关系数矩阵
correlationMatrix(data, columns, method): number[][]
```

---

*文档版本: v1.18.1*
*最后更新: 2026-06-22*
