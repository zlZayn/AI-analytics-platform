# API 设计文档

## 一、设计原则

1. **RESTful 风格** - HTTP 方法表示操作，资源命名使用名词复数
2. **统一响应格式** - 所有 API 返回 `{ success, data?, error? }`
3. **安全第一** - SQL 只允许 SELECT，禁止危险操作

---

## 二、API 列表

### 1. 连接管理

#### GET /api/connections

获取所有连接列表。

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "生产数据库",
      "description": "主要业务数据库",
      "host": "localhost",
      "port": 5432,
      "database": "mydb",
      "status": "connected",
      "tableCount": 25
    }
  ]
}
```

#### POST /api/connections

创建数据库连接。自动测试连接、加密密码、统计表数量。

**请求**:

```json
{
  "name": "生产数据库",
  "description": "可选描述",
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "username": "postgres",
  "password": "xxx",
  "ssl": false
}
```

#### GET /api/connections/:id

获取单个连接详情。

#### PUT /api/connections/:id

更新连接配置。密码留空则不更新。

#### DELETE /api/connections/:id

删除连接。

---

### 2. Schema 管理

#### GET /api/schema/:connectionId

获取数据库 Schema。首次扫描后缓存，支持 `?refresh=true` 强制刷新。

**响应**:

```json
{
  "success": true,
  "data": {
    "version": 1,
    "tables": [
      {
        "name": "orders",
        "comment": "订单表",
        "columns": [
          {
            "name": "id",
            "type": "bigint",
            "nullable": false,
            "isPrimary": true
          }
        ],
        "rowEstimate": 100000
      }
    ],
    "relations": [
      {
        "from": { "table": "orders", "column": "user_id" },
        "to": { "table": "users", "column": "id" },
        "type": "many-to-one"
      }
    ]
  }
}
```

---

### 3. 查询执行

#### POST /api/query

执行 SQL 查询。自动校验安全性、添加 LIMIT、记录历史。

**请求**:

```json
{
  "connectionId": "uuid",
  "sql": "SELECT * FROM orders LIMIT 100"
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "columns": [
      { "name": "id", "type": "bigint" },
      { "name": "amount", "type": "numeric" }
    ],
    "rows": [
      { "id": 1, "amount": 100.00 }
    ],
    "rowCount": 1,
    "executionTimeMs": 15
  }
}
```

**安全规则**:

- 只允许 SELECT / WITH / EXPLAIN / ANALYZE
- 禁止 DROP / DELETE / UPDATE / INSERT / ALTER / CREATE
- 自动添加 LIMIT 1000
- 超时控制 (默认 30s)

---

#### GET /api/query/history

获取查询历史。

**查询参数**: `connectionId` (必填)

**响应**:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sql": "SELECT ...",
      "rowCount": 100,
      "executionTimeMs": 15,
      "status": "success",
      "createdAt": "2026-06-25T10:00:00Z"
    }
  ]
}
```

---

#### GET /api/query/saved

获取保存的查询列表。

**查询参数**: `connectionId` (必填)

#### POST /api/query/saved

保存查询。

**请求**:

```json
{
  "connectionId": "uuid",
  "name": "会员统计",
  "sql": "SELECT ..."
}
```

#### DELETE /api/query/saved?id=xxx

删除保存的查询。

---

### 4. AI 分析

#### POST /api/ai

自然语言生成 SQL。

**请求**:

```json
{
  "connectionId": "uuid",
  "message": "查看各药店的会员数量统计",
  "conversationId": "可选，用于多轮对话"
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "sql": "SELECT p.name, COUNT(DISTINCT m.id) ...",
    "explanation": "查询各药店的会员数量..."
  }
}
```

---

## 三、错误处理

所有 API 错误响应格式:

```json
{
  "success": false,
  "error": "错误描述"
}
```

常见 HTTP 状态码:

| 状态码 | 说明 |
| :--- | :--- |
| 400 | 参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

*文档版本: v1.23.0*
*最后更新: 2026-06-25*
