WITH ranked_active AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY connection_id
      ORDER BY version DESC, scanned_at DESC, created_at DESC, id DESC
    ) AS position
  FROM schema_snapshots
  WHERE status = 'active'
)
UPDATE schema_snapshots AS snapshot
SET status = 'archived'
FROM ranked_active
WHERE snapshot.id = ranked_active.id
  AND ranked_active.position > 1;

CREATE UNIQUE INDEX schema_snapshots_one_active_per_connection
  ON schema_snapshots (connection_id)
  WHERE status = 'active';

ALTER TABLE query_history
  ADD COLUMN IF NOT EXISTS error_code TEXT;
