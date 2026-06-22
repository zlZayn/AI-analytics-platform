# API 设计文档

## 一、API 设计原则

### 1. RESTful 风格

- 使用 HTTP 方法表示操作
- 资源命名使用名词复数
- 状态码语义清晰

### 2. 统一响应格式

```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "timestamp": "2026-06-22T10:00:00Z"
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": []
  },
  "timestamp": "2026-06-22T10:00:00Z"
}
```

### 3. 分页格式

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## 二、API 列表

### 1. 连接管理

#### POST /api/connections

创建数据库连接

**请求**：

```json
{
  "name": "生产数据库",
  "description": "主要业务数据库",
  "host": "localhost",
  "port": 5432,
  "database": "myapp",
  "username": "readonly",
  "password": "xxx",
  "ssl": false
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "id": "xxx",
    "name": "生产数据库",
    "status": "pending",
    "created_at": "2026-06-22T10:00:00Z"
  }
}
```

**流程**：

```text
1. 验证参数
2. 加密密码
3. 测试连接
4. 保存配置
5. 触发 Schema 扫描
6. 返回结果
```

---

#### GET /api/connections

获取连接列表

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页数量，默认 20 |
| status | string | 否 | 状态筛选 |

**响应**：

```json
{
  "success": true,
  "data": [
    {
      "id": "xxx",
      "name": "生产数据库",
      "host": "localhost",
      "database": "myapp",
      "status": "connected",
      "table_count": 25,
      "last_connected_at": "2026-06-22T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

#### GET /api/connections/:id

获取连接详情

**响应**：

```json
{
  "success": true,
  "data": {
    "id": "xxx",
    "name": "生产数据库",
    "host": "localhost",
    "port": 5432,
    "database": "myapp",
    "username": "readonly",
    "status": "connected",
    "ssl": false,
    "db_version": "PostgreSQL 15.3",
    "db_size": "100 MB",
    "table_count": 25,
    "created_at": "2026-06-22T10:00:00Z"
  }
}
```

---

#### PUT /api/connections/:id

更新连接配置

**请求**：

```json
{
  "name": "生产数据库（更新）",
  "host": "new-host",
  "password": "new-password"
}
```

---

#### DELETE /api/connections/:id

删除连接

---

#### POST /api/connections/:id/test

测试连接

**响应**：

```json
{
  "success": true,
  "data": {
    "status": "connected",
    "message": "连接成功",
    "latency_ms": 15
  }
}
```

---

### 2. Schema 管理

#### GET /api/schema/:connectionId

获取 Schema 信息

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| table | string | 否 | 指定表名 |
| refresh | boolean | 否 | 强制刷新 |

**响应**：

```json
{
  "success": true,
  "data": {
    "version": 5,
    "scanned_at": "2026-06-22T10:00:00Z",
    "tables": [
      {
        "name": "orders",
        "comment": "订单表",
        "column_count": 10,
        "row_estimate": 100000
      }
    ],
    "relations": [
      {
        "from_table": "orders",
        "from_column": "user_id",
        "to_table": "users",
        "to_column": "id"
      }
    ]
  }
}
```

---

#### GET /api/schema/:connectionId/tables/:tableName

获取表详情

**响应**：

```json
{
  "success": true,
  "data": {
    "name": "orders",
    "schema": "public",
    "comment": "订单表",
    "columns": [
      {
        "name": "id",
        "type": "bigint",
        "nullable": false,
        "is_primary": true,
        "comment": "主键"
      },
      {
        "name": "user_id",
        "type": "bigint",
        "nullable": false,
        "comment": "用户ID"
      }
    ],
    "indexes": [...],
    "row_estimate": 100000,
    "total_size": "10 MB"
  }
}
```

---

#### POST /api/schema/:connectionId/refresh

刷新 Schema

**响应**：

```json
{
  "success": true,
  "data": {
    "version": 6,
    "table_count": 25,
    "changes": {
      "added": ["new_table"],
      "removed": [],
      "modified": ["orders"]
    }
  }
}
```

---

#### GET /api/schema/:connectionId/erd

获取 ER 图数据

**响应**：

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "orders",
        "label": "orders",
        "columns": ["id", "user_id", "amount"]
      }
    ],
    "edges": [
      {
        "from": "orders",
        "to": "users",
        "label": "user_id -> id"
      }
    ]
  }
}
```

---

### 3. 查询执行

#### POST /api/query

执行 SQL 查询

**请求**：

```json
{
  "connectionId": "xxx",
  "sql": "SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '30 days'",
  "limit": 1000,
  "timeout": 10000
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "columns": [
      { "name": "id", "type": "bigint" },
      { "name": "amount", "type": "numeric" },
      { "name": "created_at", "type": "timestamp" }
    ],
    "rows": [
      { "id": 1, "amount": 100.00, "created_at": "2026-06-21T10:00:00Z" }
    ],
    "row_count": 1,
    "execution_time_ms": 150
  }
}
```

**安全检查**：

- 只允许 SELECT 语句
- 自动添加 LIMIT
- 超时控制
- 禁止危险操作

---

#### POST /api/query/explain

获取执行计划

**请求**：

```json
{
  "connectionId": "xxx",
  "sql": "SELECT * FROM orders WHERE user_id = 123"
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "plan": "Seq Scan on orders  (cost=0.00..1520.00 rows=10 width=56)",
    "analysis": "建议在 user_id 字段添加索引"
  }
}
```

---

#### GET /api/query/history

获取查询历史

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| connectionId | string | 否 | 连接 ID |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页数量 |
| startDate | string | 否 | 开始日期 |
| endDate | string | 否 | 结束日期 |

---

#### POST /api/query/save

保存查询

**请求**：

```json
{
  "connectionId": "xxx",
  "name": "最近30天订单",
  "description": "查询最近30天的订单数据",
  "sql": "SELECT ...",
  "chartType": "line",
  "chartConfig": {...},
  "tags": ["订单", "趋势"]
}
```

---

#### GET /api/query/saved

获取保存的查询列表

---

### 4. AI 分析

#### POST /api/ai/analyze

AI 分析需求

**请求**：

```json
{
  "connectionId": "xxx",
  "message": "分析最近30天各分类的销售趋势",
  "conversationId": "yyy"  // 可选，用于多轮对话
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "conversationId": "yyy",
    "messageId": "zzz",
    "analysis": {
      "type": "trend",
      "description": "分析最近30天各分类的销售趋势",
      "sql": "SELECT ...",
      "chartConfig": {
        "type": "line",
        "title": "各分类销售趋势",
        "xAxis": "date",
        "yAxis": "amount",
        "groupBy": "category"
      },
      "insights": [
        "电子产品类销售额最高",
        "服装类呈下降趋势"
      ],
      "followUp": [
        "查看具体商品销量排行",
        "分析各分类占比",
        "对比上月同期"
      ]
    }
  }
}
```

---

#### POST /api/ai/execute

执行 AI 生成的查询

**请求**：

```json
{
  "connectionId": "xxx",
  "messageId": "zzz"
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "columns": [...],
    "rows": [...],
    "row_count": 30,
    "execution_time_ms": 200
  }
}
```

---

#### GET /api/ai/conversations

获取 AI 会话列表

---

#### GET /api/ai/conversations/:id

获取会话详情（包含消息历史）

---

#### GET /api/ai/templates

获取分析模板列表

---

### 5. 可视化

#### POST /api/chart/generate

根据数据生成图表配置

**请求**：

```json
{
  "data": [...],
  "hint": "trend"
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "chartType": "line",
    "config": {
      "xAxis": "date",
      "yAxis": "amount",
      "title": "销售趋势"
    }
  }
}
```

---

#### POST /api/chart/preview

预览图表

**请求**：

```json
{
  "chartType": "line",
  "data": [...],
  "config": {...}
}
```

---

### 6. 仪表板

#### POST /api/dashboards

创建仪表板

**请求**：

```json
{
  "name": "销售分析仪表板",
  "description": "展示销售核心指标",
  "connectionId": "xxx"
}
```

---

#### GET /api/dashboards

获取仪表板列表

---

#### GET /api/dashboards/:id

获取仪表板详情（包含组件）

---

#### PUT /api/dashboards/:id

更新仪表板

---

#### DELETE /api/dashboards/:id

删除仪表板

---

#### POST /api/dashboards/:id/widgets

添加组件

**请求**：

```json
{
  "name": "销售趋势",
  "type": "chart",
  "queryId": "xxx",
  "chartType": "line",
  "positionX": 0,
  "positionY": 0,
  "width": 6,
  "height": 4
}
```

---

#### PUT /api/dashboards/:id/widgets/:widgetId

更新组件（位置、配置）

---

#### DELETE /api/dashboards/:id/widgets/:widgetId

删除组件

---

#### POST /api/dashboards/:id/share

生成分享链接

**响应**：

```json
{
  "success": true,
  "data": {
    "shareUrl": "https://xxx/dashboards/shared/abc123",
    "expiresAt": "2026-07-22T10:00:00Z"
  }
}
```

---

## 三、认证与授权

### 认证方式

使用 JWT Token：

```text
Authorization: Bearer <token>
```

### 认证流程

```text
1. 用户登录 → POST /api/auth/login
2. 返回 JWT Token
3. 后续请求携带 Token
4. API 验证 Token 有效性
```

### 权限模型

| 角色 | 权限 |
| :--- | :--- |
| admin | 所有操作 |
| user | 管理自己的连接、查询、仪表板 |
| viewer | 只读，只能查看 |

---

## 四、错误码

| 错误码 | 说明 |
| :--- | :--- |
| VALIDATION_ERROR | 参数验证失败 |
| UNAUTHORIZED | 未认证 |
| FORBIDDEN | 无权限 |
| NOT_FOUND | 资源不存在 |
| CONNECTION_FAILED | 数据库连接失败 |
| QUERY_TIMEOUT | 查询超时 |
| QUERY_ERROR | SQL 执行错误 |
| AI_ERROR | AI 服务错误 |
| RATE_LIMITED | 请求过于频繁 |

---

## 五、限流策略

| API | 限制 |
| :--- | :--- |
| /api/query | 60 次/分钟 |
| /api/ai/analyze | 20 次/分钟 |
| /api/schema/refresh | 5 次/分钟 |

---

*文档版本: v1.11.0*
*最后更新: 2026-06-22*
