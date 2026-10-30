-- 001: Ensure schema_migrations exists (also created by runner; idempotent).
-- Note: runner creates this table before applying files; this file documents intent.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(128) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  checksum CHAR(64) NOT NULL,
  applied_at DATETIME(3) NOT NULL,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
