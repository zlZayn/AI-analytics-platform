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
SQL 生成 + 解释
    ↓
前端执行 SQL + 可视化
```

---

## 二、AI Service

### 文件

`src/lib/ai-service.ts`

### 接口

```typescript
generateSQL(
  message: string,           // 用户输入
  schemaContext: string,     // Schema 上下文
  conversationHistory?: {    // 多轮对话历史
    role: 'user' | 'assistant'
    content: string
  }[]
): Promise<{ sql: string; explanation: string }>
```

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

### System Prompt 结构

1. **角色定义** - 你是 PostgreSQL SQL 专家
2. **Schema 说明** - 星型模型结构 (维度表 + 事实表)
3. **业务指标公式** - 销售额、客单价、复购率等
4. **SQL 生成规则** - 只生成 SELECT、使用 JOIN、添加 LIMIT
5. **输出格式** - 返回 JSON `{ sql, explanation }`

### Schema 上下文

由 `buildSchemaContext()` 生成，包含:

- 表结构 (表名、字段、类型、注释)
- 表关联 (外键关系)
- 星型模型业务说明
- 常用 JOIN 模式
- 分析示例

---

## 四、SQL 提取

从 AI 返回的文本中提取 SQL:

1. 尝试匹配 ` ```sql ... ``` ` 代码块
2. 逐行检测 SQL 关键字 (SELECT/WITH/EXPLAIN)
3. 兜底: 将整个文本作为 SQL

---

## 五、多轮对话

前端维护消息历史，每次请求携带最近 10 条对话记录。AI 根据上下文生成更准确的 SQL。

---

*文档版本: v1.19.0*
*最后更新: 2026-06-25*
