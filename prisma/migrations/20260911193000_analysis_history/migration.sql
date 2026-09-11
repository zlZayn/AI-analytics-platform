-- 分析历史（AI 提问 + R 执行）：与 query_history 同库同轴，连接级作用域。
-- 手写并幂等：元库与业务表同库，禁止 prisma db push / migrate（见 prisma/README.md）。

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
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS analysis_history_connection_id_idx
  ON analysis_history (connection_id);

CREATE INDEX IF NOT EXISTS analysis_history_created_at_idx
  ON analysis_history (created_at DESC);

CREATE INDEX IF NOT EXISTS analysis_history_connection_created_idx
  ON analysis_history (connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analysis_history_user_id_idx
  ON analysis_history (user_id);
