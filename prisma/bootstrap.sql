-- 元库基线：全量建表（幂等）
--
-- 用途：空库从零初始化到当前可用状态；也可在现有库上重复执行（全部 IF NOT EXISTS，无数据改动）。
-- 与 schema.prisma 的关系：schema.prisma 是意图，本文件是"从零可重建"的基线，两者由 npm run db:check 校验漂移。
-- 业务表（fact_* / dim_*）不在此文件内：元库与业务表同库，本文件只建平台自己的表。
-- 手工维护：新增模型时同时补这里与 prisma/migrations/ 下的增量补丁（禁止 db push / migrate）。

-- 用户
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  status        TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);

-- 固定属主：平台尚未接入登录，服务端一律以 user_id = 'default-user' 落库（连接、历史等外键依赖它）
INSERT INTO users (id, username, email, password_hash, role, status, created_at, updated_at)
VALUES ('default-user', 'admin', 'admin@example.com', 'n/a', 'user', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 数据库连接
CREATE TABLE IF NOT EXISTS connections (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  host               TEXT NOT NULL,
  port               INTEGER NOT NULL DEFAULT 5432,
  database           TEXT NOT NULL,
  username           TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  ssl                BOOLEAN NOT NULL DEFAULT false,
  ssl_mode           TEXT,
  pool_min           INTEGER NOT NULL DEFAULT 2,
  pool_max           INTEGER NOT NULL DEFAULT 10,
  idle_timeout       INTEGER NOT NULL DEFAULT 30,
  status             TEXT NOT NULL DEFAULT 'pending',
  last_connected_at  TIMESTAMP,
  error_message      TEXT,
  db_version         TEXT,
  db_size            BIGINT,
  table_count        INTEGER,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS connections_user_id_idx ON connections (user_id);
CREATE INDEX IF NOT EXISTS connections_status_idx ON connections (status);

-- Schema 快照
CREATE TABLE IF NOT EXISTS schema_snapshots (
  id            TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections (id) ON UPDATE CASCADE ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  schema_json   JSONB NOT NULL,
  table_count   INTEGER NOT NULL,
  column_count  INTEGER NOT NULL,
  relation_count INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  error_message TEXT,
  scanned_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS schema_snapshots_connection_id_idx ON schema_snapshots (connection_id);
CREATE INDEX IF NOT EXISTS schema_snapshots_connection_id_version_idx ON schema_snapshots (connection_id, version DESC);
-- 每个连接最多一个 active 快照（应用层同时校验；若库里已存在重复 active，本语句会失败并提示先清理）
CREATE UNIQUE INDEX IF NOT EXISTS schema_snapshots_one_active_per_connection ON schema_snapshots (connection_id) WHERE status = 'active';

-- 保存的查询
CREATE TABLE IF NOT EXISTS saved_queries (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  connection_id    TEXT NOT NULL REFERENCES connections (id) ON UPDATE CASCADE ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  sql_content      TEXT NOT NULL,
  chart_type       TEXT,
  chart_config     JSONB,
  tags             TEXT[],
  folder           TEXT,
  execution_count  INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMP,
  is_public        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS saved_queries_user_id_idx ON saved_queries (user_id);
CREATE INDEX IF NOT EXISTS saved_queries_connection_id_idx ON saved_queries (connection_id);

-- 查询历史（SQL 执行；权威源）
CREATE TABLE IF NOT EXISTS query_history (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  connection_id    TEXT NOT NULL REFERENCES connections (id) ON UPDATE CASCADE ON DELETE CASCADE,
  sql_content      TEXT NOT NULL,
  status           TEXT NOT NULL,
  execution_time_ms INTEGER,
  row_count        INTEGER,
  error_message    TEXT,
  result_summary   TEXT,
  result_cache     JSONB,
  is_ai_generated  BOOLEAN NOT NULL DEFAULT false,
  ai_prompt        TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error_code       TEXT
);
CREATE INDEX IF NOT EXISTS query_history_user_id_idx ON query_history (user_id);
CREATE INDEX IF NOT EXISTS query_history_connection_id_idx ON query_history (connection_id);
CREATE INDEX IF NOT EXISTS query_history_created_at_idx ON query_history (created_at DESC);

-- 分析历史（AI 提问 + R 执行；权威源）
CREATE TABLE IF NOT EXISTS analysis_history (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES connections (id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL,
  kind          TEXT NOT NULL,
  ok            BOOLEAN NOT NULL DEFAULT true,
  question      TEXT,
  summary       TEXT,
  items         JSONB,
  code          TEXT,
  source_sql    TEXT,
  output        JSONB,
  image_count   INTEGER,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS analysis_history_user_id_idx ON analysis_history (user_id);
CREATE INDEX IF NOT EXISTS analysis_history_connection_id_idx ON analysis_history (connection_id);
CREATE INDEX IF NOT EXISTS analysis_history_created_at_idx ON analysis_history (created_at DESC);
CREATE INDEX IF NOT EXISTS analysis_history_connection_created_idx ON analysis_history (connection_id, created_at DESC);

-- 仪表板
CREATE TABLE IF NOT EXISTS dashboards (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  connection_id    TEXT REFERENCES connections (id) ON UPDATE CASCADE ON DELETE SET NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  layout           JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_refresh     BOOLEAN NOT NULL DEFAULT false,
  refresh_interval INTEGER NOT NULL DEFAULT 300,
  is_public        BOOLEAN NOT NULL DEFAULT false,
  share_token      TEXT,
  view_count       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS dashboards_share_token_key ON dashboards (share_token);
CREATE INDEX IF NOT EXISTS dashboards_user_id_idx ON dashboards (user_id);

-- 仪表板组件
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id               TEXT PRIMARY KEY,
  dashboard_id     TEXT NOT NULL REFERENCES dashboards (id) ON UPDATE CASCADE ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  type             TEXT NOT NULL,
  query_id         TEXT,
  custom_sql       TEXT,
  chart_type       TEXT,
  chart_config     JSONB,
  data_cache       JSONB,
  last_refreshed_at TIMESTAMP,
  position_x       INTEGER NOT NULL DEFAULT 0,
  position_y       INTEGER NOT NULL DEFAULT 0,
  width            INTEGER NOT NULL DEFAULT 6,
  height           INTEGER NOT NULL DEFAULT 4,
  title            TEXT,
  show_title       BOOLEAN NOT NULL DEFAULT true,
  background_color TEXT,
  border_color     TEXT,
  auto_refresh     BOOLEAN NOT NULL DEFAULT false,
  refresh_interval INTEGER NOT NULL DEFAULT 300,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS dashboard_widgets_dashboard_id_idx ON dashboard_widgets (dashboard_id);

-- 分析模板
CREATE TABLE IF NOT EXISTS analysis_templates (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL,
  prompt_template       TEXT NOT NULL,
  sql_template          TEXT,
  chart_type            TEXT NOT NULL,
  chart_config_template JSONB,
  required_tables       TEXT[],
  required_columns      JSONB,
  usage_count           INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  is_system             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS analysis_templates_category_idx ON analysis_templates (category);

-- AI 会话
CREATE TABLE IF NOT EXISTS ai_conversations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  connection_id TEXT REFERENCES connections (id) ON UPDATE CASCADE ON DELETE SET NULL,
  title         TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_conversations_user_id_idx ON ai_conversations (user_id);

-- AI 消息
CREATE TABLE IF NOT EXISTS ai_messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES ai_conversations (id) ON UPDATE CASCADE ON DELETE CASCADE,
  role             TEXT NOT NULL,
  content          TEXT NOT NULL,
  generated_sql    TEXT,
  execution_result JSONB,
  chart_config     JSONB,
  token_count      INTEGER,
  execution_time_ms INTEGER,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_idx ON ai_messages (conversation_id);
CREATE INDEX IF NOT EXISTS ai_messages_created_at_idx ON ai_messages (created_at DESC);

-- 系统配置
CREATE TABLE IF NOT EXISTS system_configs (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  description  TEXT,
  category     TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT false,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL
);
