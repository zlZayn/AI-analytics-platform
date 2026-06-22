"""
测试 AI 生成 SQL 的效果
连接 pharmacy_member 数据库，测试 AI 是否能正确生成查询
"""

import json
import requests
import psycopg2
from psycopg2.extras import RealDictCursor

# AI 配置
AI_CONFIG = {
    "api_base": "https://token-plan-cn.xiaomimimo.com/v1",
    "api_key": "tp-ce8bn0o4v1mimshlmqdqxuvtrpogqkrdohhmltvequrfy6dx",
    "model": "mimo-v2.5-pro"
}

# 数据库配置
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "pharmacy_member",
    "user": "postgres",
    "password": "Lzy20050914"
}


def get_schema_context():
    """获取数据库 Schema 上下文"""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # 获取所有表
    cursor.execute("""
        SELECT table_name, obj_description((quote_ident(table_name))::regclass) as comment
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = cursor.fetchall()

    context = "## 数据库结构\n\n"

    for table in tables:
        table_name = table['table_name']
        comment = table.get('comment', '') or ''

        # 获取列信息
        cursor.execute("""
            SELECT
                c.column_name,
                c.data_type,
                c.is_nullable,
                col_description((quote_ident(c.table_name))::regclass, c.ordinal_position) as comment,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = %s
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_name = %s
            ORDER BY c.ordinal_position
        """, (table_name, table_name))
        columns = cursor.fetchall()

        context += f"### {table_name}"
        if comment:
            context += f" ({comment})"
        context += "\n"

        for col in columns:
            col_comment = col.get('comment', '') or ''
            parts = [col['column_name'], col['data_type']]
            if col['is_primary']:
                parts.append('PK')
            if col['is_nullable'] == 'NO':
                parts.append('NOT NULL')
            if col_comment:
                parts.append(f"-- {col_comment}")
            context += f"- {' '.join(parts)}\n"

        context += "\n"

    # 获取外键关系
    cursor.execute("""
        SELECT
            tc.table_name as from_table,
            kcu.column_name as from_column,
            ccu.table_name as to_table,
            ccu.column_name as to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
    """)
    relations = cursor.fetchall()

    if relations:
        context += "### 表关系\n"
        for rel in relations:
            context += f"- {rel['from_table']}.{rel['from_column']} -> {rel['to_table']}.{rel['to_column']}\n"

    cursor.close()
    conn.close()

    return context


def call_ai(message, schema_context):
    """调用 AI 生成 SQL"""
    system_prompt = f"""你是一个专业的数据分析助手。根据用户的自然语言需求，生成 PostgreSQL 查询。

## 数据库结构
{schema_context}

## 输出要求
请返回 JSON 格式：
{{
  "sql": "SELECT 查询语句",
  "explanation": "查询逻辑说明",
  "chart_type": "line/bar/pie/scatter/table"
}}

## 规则
1. 只生成 SELECT 查询
2. 使用标准 PostgreSQL 语法
3. 合理使用 JOIN
4. 时间字段使用 date_trunc 控制粒度"""

    headers = {
        "Authorization": f"Bearer {AI_CONFIG['api_key']}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": AI_CONFIG["model"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ],
        "temperature": 0.7,
        "max_tokens": 1000
    }

    response = requests.post(
        f"{AI_CONFIG['api_base']}/chat/completions",
        headers=headers,
        json=payload,
        timeout=30
    )

    if response.status_code != 200:
        raise Exception(f"AI API error: {response.status_code} - {response.text}")

    result = response.json()
    content = result['choices'][0]['message']['content']

    # 尝试解析 JSON
    try:
        # 提取 JSON 部分
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0].strip()
        else:
            json_str = content

        return json.loads(json_str)
    except json.JSONDecodeError:
        # 尝试直接解析
        return json.loads(content)


def execute_sql(sql):
    """执行 SQL 并返回结果"""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cursor.execute(sql)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return {
            "success": True,
            "columns": columns,
            "rows": [dict(row) for row in rows[:100]],  # 限制 100 行
            "row_count": len(rows)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        cursor.close()
        conn.close()


def test_ai_analysis(question):
    """测试 AI 分析"""
    print(f"\n{'='*60}")
    print(f"问题: {question}")
    print('='*60)

    # 1. 获取 Schema
    print("\n[1] 获取 Schema 上下文...")
    schema_context = get_schema_context()
    print(f"    Schema 长度: {len(schema_context)} 字符")

    # 2. 调用 AI
    print("\n[2] 调用 AI 生成 SQL...")
    try:
        ai_result = call_ai(question, schema_context)
        print(f"    AI 返回:")
        print(f"    - SQL: {ai_result.get('sql', 'N/A')[:100]}...")
        print(f"    - 说明: {ai_result.get('explanation', 'N/A')}")
        print(f"    - 图表类型: {ai_result.get('chart_type', 'N/A')}")
    except Exception as e:
        print(f"    AI 调用失败: {e}")
        return

    # 3. 执行 SQL
    sql = ai_result.get('sql')
    if sql:
        print(f"\n[3] 执行 SQL...")
        result = execute_sql(sql)

        if result['success']:
            print(f"    执行成功!")
            print(f"    返回行数: {result['row_count']}")
            print(f"    列: {result['columns']}")
            print(f"    前 5 行:")
            for i, row in enumerate(result['rows'][:5]):
                print(f"      {i+1}. {row}")
        else:
            print(f"    执行失败: {result['error']}")

    print()


def main():
    print("=" * 60)
    print("AI 生成 SQL 效果测试")
    print("=" * 60)

    # 测试用例
    test_cases = [
        "查看所有会员的数量",
        "统计每个药店的会员数量",
        "查看最近创建的 10 个会员",
        "统计不同性别的会员数量",
        "查看所有药店的信息",
    ]

    for question in test_cases:
        test_ai_analysis(question)

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
