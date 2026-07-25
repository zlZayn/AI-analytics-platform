# 数据库设计文档

## 一、设计原则

### 1. 元数据与业务数据分离

- **平台数据库**：存储平台运行所需的所有元数据
- **用户数据库**：存储用户的真实业务数据
- 平台只读取用户数据库的 Schema，不存储业务数据

### 2. 规范化设计

- 遵循第三范式（3NF）
- 适当反规范化提升查询性能

### 3. 可扩展性

- 使用 JSON 字段存储灵活配置
- 预留扩展字段

---

## 二、数据库表结构

### 1. users - 用户表

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    role VARCHAR(20) DEFAULT 'user',  -- admin, user, viewer
    status VARCHAR(20) DEFAULT 'active',  -- active, inactive, suspended
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

**说明**：存储平台用户信息，支持 RBAC 权限。

---

### 2. connections - 数据库连接配置

```sql
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- 连接配置
    host VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 5432,
    database VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL,  -- AES-256 加密
    ssl BOOLEAN DEFAULT false,
    ssl_mode VARCHAR(20) DEFAULT 'prefer',
    
    -- 连接池配置
    pool_min INTEGER DEFAULT 2,
    pool_max INTEGER DEFAULT 10,
    idle_timeout INTEGER DEFAULT 30,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending',  -- pending, connected, error, disconnected
    last_connected_at TIMESTAMP,
    error_message TEXT,
    
    -- 元信息
    db_version VARCHAR(50),
    db_size BIGINT,
    table_count INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_connections_user_id ON connections(user_id);
CREATE INDEX idx_connections_status ON connections(status);
```

**说明**：存储用户配置的数据库连接，密码加密存储。

---

### 3. schema_snapshots - Schema 快照

```sql
CREATE TABLE schema_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- Schema 内容（JSON 格式）
    schema_json JSONB NOT NULL,
    
    -- 统计信息
    table_count INTEGER,
    column_count INTEGER,
    relation_count INTEGER,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active',  -- active, outdated, error
    error_message TEXT,
    
    -- 时间
    scanned_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_schema_snapshots_connection_id ON schema_snapshots(connection_id);
CREATE INDEX idx_schema_snapshots_version ON schema_snapshots(connection_id, version DESC);

-- 唯一约束：每个连接只有一个 active 快照
CREATE UNIQUE INDEX idx_schema_active ON schema_snapshots(connection_id) WHERE status = 'active';
```

**说明**：存储数据库 Schema 快照，用于 AI 上下文和变更检测。

**schema_json 结构**：

```json
{
  "tables": [
    {
      "name": "orders",
      "schema": "public",
      "comment": "订单表",
      "columns": [
        {
          "name": "id",
          "type": "bigint",
          "nullable": false,
          "is_primary": true,
          "comment": "主键",
          "default": "nextval('orders_id_seq')"
        },
        {
          "name": "user_id",
          "type": "bigint",
          "nullable": false,
          "is_primary": false,
          "comment": "用户ID"
        },
        {
          "name": "amount",
          "type": "numeric(10,2)",
          "nullable": false,
          "comment": "订单金额"
        },
        {
          "name": "status",
          "type": "varchar(20)",
          "nullable": false,
          "comment": "订单状态: pending/paid/shipped/completed/cancelled"
        },
        {
          "name": "created_at",
          "type": "timestamp",
          "nullable": false,
          "default": "now()",
          "comment": "创建时间"
        }
      ],
      "indexes": [
        {
          "name": "orders_pkey",
          "columns": ["id"],
          "unique": true
        },
        {
          "name": "idx_orders_user_id",
          "columns": ["user_id"],
          "unique": false
        }
      ],
      "row_estimate": 100000,
      "total_size": "10 MB"
    }
  ],
  "relations": [
    {
      "name": "orders_user_id_fkey",
      "from_table": "orders",
      "from_column": "user_id",
      "to_table": "users",
      "to_column": "id",
      "type": "many-to-one"
    }
  ]
}
```

---

### 4. saved_queries - 保存的查询

```sql
CREATE TABLE saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sql_content TEXT NOT NULL,
    
    -- 可视化配置
    chart_type VARCHAR(50),  -- line, bar, pie, scatter, table
    chart_config JSONB,  -- 图表配置
    
    -- 分类
    tags TEXT[],  -- 标签数组
    folder VARCHAR(100),  -- 文件夹
    
    -- 统计
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP,
    
    -- 共享
    is_public BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_saved_queries_user_id ON saved_queries(user_id);
CREATE INDEX idx_saved_queries_connection_id ON saved_queries(connection_id);
CREATE INDEX idx_saved_queries_tags ON saved_queries USING GIN(tags);
```

**说明**：存储用户保存的 SQL 查询和可视化配置。

---

### 5. query_history - 查询历史

```sql
CREATE TABLE query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,

    sql_content TEXT NOT NULL,

    -- 执行信息
    status VARCHAR(20) NOT NULL,  -- success, error, timeout
    execution_time_ms INTEGER,  -- 执行耗时
    row_count INTEGER,  -- 返回行数
    error_message TEXT,

    -- 结果
    result_summary TEXT,  -- 查询结果摘要（前几行文本）
    result_cache JSONB,  -- 查询结果缓存（可选）

    -- AI 相关
    is_ai_generated BOOLEAN DEFAULT false,
    ai_prompt TEXT,  -- 用户的自然语言输入

    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_query_history_user_id ON query_history(user_id);
CREATE INDEX idx_query_history_connection_id ON query_history(connection_id);
CREATE INDEX idx_query_history_created_at ON query_history(created_at DESC);

-- 自动清理：只保留最近 1000 条
CREATE OR REPLACE FUNCTION cleanup_query_history()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM query_history 
    WHERE user_id = NEW.user_id 
    AND id NOT IN (
        SELECT id FROM query_history 
        WHERE user_id = NEW.user_id 
        ORDER BY created_at DESC 
        LIMIT 1000
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_query_history
    AFTER INSERT ON query_history
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_query_history();
```

**说明**：记录所有查询执行历史，支持审计和性能分析。

---

### 6. dashboards - 仪表板

```sql
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- 布局配置
    layout JSONB DEFAULT '[]'::JSONB,
    
    -- 设置
    auto_refresh BOOLEAN DEFAULT false,
    refresh_interval INTEGER DEFAULT 300,  -- 秒
    
    -- 共享
    is_public BOOLEAN DEFAULT false,
    share_token VARCHAR(100) UNIQUE,
    
    -- 统计
    view_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_dashboards_user_id ON dashboards(user_id);
CREATE INDEX idx_dashboards_share_token ON dashboards(share_token);
```

**说明**：存储仪表板配置和布局。

**layout JSON 结构**：

```json
[
  {
    "id": "widget-1",
    "type": "chart",
    "query_id": "xxx",
    "position": { "x": 0, "y": 0, "w": 6, "h": 4 },
    "config": {}
  },
  {
    "id": "widget-2",
    "type": "metric",
    "query_id": "yyy",
    "position": { "x": 6, "y": 0, "w": 3, "h": 2 },
    "config": {}
  }
]
```

---

### 7. dashboard_widgets - 仪表板组件

```sql
CREATE TABLE dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- 组件类型
    type VARCHAR(50) NOT NULL,  -- chart, metric, table, text, filter

    -- 关联查询
    query_id UUID REFERENCES saved_queries(id) ON DELETE SET NULL,
    custom_sql TEXT,  -- 自定义 SQL（如果没有保存查询）

    -- 图表配置
    chart_type VARCHAR(50),  -- line, bar, pie, scatter
    chart_config JSONB,

    -- 数据缓存
    data_cache JSONB,  -- 缓存查询结果
    last_refreshed_at TIMESTAMP,  -- 最后刷新时间

    -- 布局
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 6,
    height INTEGER DEFAULT 4,

    -- 样式
    title VARCHAR(200),
    show_title BOOLEAN DEFAULT true,
    background_color VARCHAR(20),
    border_color VARCHAR(20),

    -- 刷新
    auto_refresh BOOLEAN DEFAULT false,
    refresh_interval INTEGER DEFAULT 300,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_dashboard_widgets_dashboard_id ON dashboard_widgets(dashboard_id);
```

**说明**：存储仪表板中的各个组件。

---

### 8. analysis_templates - 分析模板

```sql
CREATE TABLE analysis_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,  -- trend, distribution, ranking, comparison, funnel
    
    -- 模板内容
    prompt_template TEXT NOT NULL,  -- AI Prompt 模板
    sql_template TEXT,  -- SQL 模板（可选）
    chart_type VARCHAR(50) NOT NULL,
    chart_config_template JSONB,
    
    -- 适用条件
    required_tables TEXT[],  -- 需要的表
    required_columns JSONB,  -- 需要的字段类型
    
    -- 使用统计
    usage_count INTEGER DEFAULT 0,
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT true,  -- 系统内置 vs 用户自定义
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_analysis_templates_category ON analysis_templates(category);
```

**说明**：预定义的分析模板，AI 可以根据 Schema 自动匹配。

**模板示例**：

```json
{
  "name": "销售趋势分析",
  "category": "trend",
  "prompt_template": "分析{{time_range}}内{{metric}}的变化趋势，按{{dimension}}分组",
  "required_tables": ["orders"],
  "required_columns": {
    "orders": ["created_at", "amount"]
  },
  "chart_type": "line"
}
```

---

### 9. ai_conversations - AI 会话

```sql
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
    
    title VARCHAR(200),  -- 会话标题（自动生成）
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active',  -- active, archived
    
    -- 统计
    message_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
```

**说明**：AI 对话会话主表。

---

### 10. ai_messages - AI 消息

```sql
CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    
    role VARCHAR(20) NOT NULL,  -- user, assistant, system
    content TEXT NOT NULL,
    
    -- AI 生成的内容
    generated_sql TEXT,  -- AI 生成的 SQL
    execution_result JSONB,  -- 执行结果
    chart_config JSONB,  -- 图表配置
    
    -- 元信息
    token_count INTEGER,  -- Token 消耗
    execution_time_ms INTEGER,  -- 执行耗时
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_created_at ON ai_messages(created_at DESC);
```

**说明**：存储 AI 对话的每条消息，包含生成的 SQL 和结果。

---

### 11. system_configs - 系统配置

```sql
CREATE TABLE system_configs (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    
    -- 分类
    category VARCHAR(50),  -- ai, security, performance, ui
    
    -- 元信息
    is_public BOOLEAN DEFAULT false,  -- 是否前端可读
    is_sensitive BOOLEAN DEFAULT false,  -- 是否敏感配置
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 初始配置
INSERT INTO system_configs (key, value, description, category) VALUES
('ai.provider', '"openai"', 'AI 服务提供商', 'ai'),
('ai.model', '"gpt-4o"', 'AI 模型名称', 'ai'),
('ai.max_tokens', '4096', '最大 Token 数', 'ai'),
('ai.temperature', '0.7', '温度参数', 'ai'),
('security.sql_timeout', '10000', 'SQL 执行超时(ms)', 'security'),
('security.max_rows', '1000', '最大返回行数', 'security'),
('security.allowed_operations', '["SELECT", "WITH"]', '允许的 SQL 操作', 'security'),
('performance.schema_cache_ttl', '86400', 'Schema 缓存 TTL(秒)', 'performance'),
('performance.query_cache_ttl', '300', '查询缓存 TTL(秒)', 'performance');
```

**说明**：存储系统配置，支持动态调整。

---

## 三、表关系

- users 是核心表，一个用户可以拥有多个 connections、saved_queries、query_history、dashboards、ai_conversations
- connections 通过 user_id 关联 users，一个连接可以有多个 schema_snapshots
- schema_snapshots 通过 connection_id 关联 connections，存储每次扫描的 Schema 快照
- saved_queries 和 query_history 通过 user_id 和 connection_id 关联用户和连接
- dashboards 和 ai_conversations 通过 user_id 关联用户

---

## 四、索引策略

### 高频查询字段

| 表 | 索引 | 原因 |
| :--- | :--- | :--- |
| users | email | 登录查询 |
| users | status | 状态筛选 |
| connections | user_id | 用户连接列表 |
| connections | status | 状态筛选 |
| schema_snapshots | connection_id, version | 版本查询 |
| saved_queries | user_id | 用户查询列表 |
| saved_queries | tags (GIN) | 标签搜索 |
| query_history | user_id, created_at | 历史查询 |
| dashboards | user_id | 用户仪表板列表 |
| dashboards | share_token | 分享链接 |
| ai_conversations | user_id | 用户会话列表 |
| ai_messages | conversation_id | 会话消息 |

---

## 五、数据完整性

### 外键约束

所有外键关系已在表定义中声明。

### 检查约束

```sql
-- 用户角色
ALTER TABLE users ADD CONSTRAINT chk_users_role 
    CHECK (role IN ('admin', 'user', 'viewer'));

-- 用户状态
ALTER TABLE users ADD CONSTRAINT chk_users_status 
    CHECK (status IN ('active', 'inactive', 'suspended'));

-- 连接状态
ALTER TABLE connections ADD CONSTRAINT chk_connections_status 
    CHECK (status IN ('pending', 'connected', 'error', 'disconnected'));

-- 查询状态
ALTER TABLE query_history ADD CONSTRAINT chk_query_history_status 
    CHECK (status IN ('success', 'error', 'timeout'));

-- AI 消息角色
ALTER TABLE ai_messages ADD CONSTRAINT chk_ai_messages_role 
    CHECK (role IN ('user', 'assistant', 'system'));
```

---

## 六、触发器

### 自动更新 updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有需要的表创建触发器
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_connections_updated_at
    BEFORE UPDATE ON connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_saved_queries_updated_at
    BEFORE UPDATE ON saved_queries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_dashboards_updated_at
    BEFORE UPDATE ON dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_ai_conversations_updated_at
    BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 七、数据量预估

| 表 | 初期 | 中期 | 后期 |
| :--- | :--- | :--- | :--- |
| users | 100 | 10,000 | 100,000 |
| connections | 200 | 20,000 | 200,000 |
| schema_snapshots | 200 | 20,000 | 200,000 |
| saved_queries | 500 | 50,000 | 500,000 |
| query_history | 10,000 | 1,000,000 | 10,000,000 |
| dashboards | 100 | 10,000 | 100,000 |
| ai_conversations | 1,000 | 100,000 | 1,000,000 |
| ai_messages | 10,000 | 1,000,000 | 10,000,000 |

---

## 八、分区策略（后期）

对于大表，按时间分区：

```sql
-- query_history 按月分区
CREATE TABLE query_history (
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE query_history_2024_01 PARTITION OF query_history
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE query_history_2024_02 PARTITION OF query_history
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

---

## 九、业务数据 Schema (星型模型)

演示数据使用星型架构存储在 `ai_analytics` 数据库中。

### 维度表 (dim_)

| 表名 | 说明 | 主要字段 |
| :--- | :--- | :--- |
| dim_date | 日期维度 | date_key, year, quarter, month, is_weekend, is_holiday |
| dim_member | 会员 | name, phone, gender, birth_date, register_date, level, segment, is_active |
| dim_product | 商品 | name, category_l1, category_l2, brand, specification, dosage_form, price, is_rx, is_hot |
| dim_pharmacy | 门店 | name, city, district, store_type, address, opening_date |
| dim_promotion | 促销 | name, type, min_amount, discount_amount, discount_rate |
| dim_payment | 支付方式 | code, name |

### 事实表 (fact_)

| 表名 | 粒度 | 主要度量 |
| :--- | :--- | :--- |
| fact_orders | 订单行 (每件商品一行) | quantity, unit_price, total_amount, discount_amount, pay_amount, points_earned, refund_flag |
| fact_behavior | 单次行为 | action (view/favorite/cart/purchase), channel, session_id, referrer |
| fact_inventory | 库存变动 | change_type, quantity, before_stock, after_stock |
| fact_refunds | 退款记录 | refund_amount, refund_reason, refund_date |

### 数据库连接

- 主机: localhost
- 端口: 5432
- 数据库名: ai_analytics
- 用户名: postgres
- 密码: Lzy20050914

### 数据生成

```bash
python scripts/seed.py
```

脚本位于 `scripts/seed.py`，使用 numpy 生成 Zipf 分布商品权重、指数分布购买间隔、节假日脉冲等真实数据分布。

---

*文档版本: v1.23.0*
*最后更新: 2026-06-22*
