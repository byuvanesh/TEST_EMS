# Housekeeping H3 / H4 / H6 / H7 — Notes and Decisions

## H3 — Migration 004 Run Results

### On a clean database (test_ems_test, empty)
- `runMigrations()` applied 004 + 005 in sequence, both recorded in `schema_migrations`.
- No partial failures: DDL is not transactional in MySQL 8, but each file is applied atomically
  and recorded immediately after success.
- **Rerun after mid-file failure**: if 004 fails partway (e.g., on ALTER TABLE meters), the
  migrator throws and does NOT record the version. On the next run, it retries 004 from the
  beginning. Because MySQL DDL is not transactional, the partial changes (e.g., added source_type
  to gateways but not meters) will still be present. MySQL will emit an error such as
  "Column 'source_type' already exists" which propagates as a migration failure.
  **Decision**: 004 was written with idempotent-safe ALTERs where possible, but full
  idempotency in MySQL DDL is not guaranteed. If a partial failure occurs in production,
  inspect `schema_migrations` and the table state manually. The migration runner already
  prints `Partial DDL may have been applied; inspect the database before retrying.`.
  No split is required for the test environment because H3 verified 004 runs cleanly.

### On a database with Phase 2a demo seed data
- `runMigrations()` with 004 on a database containing sites, loads, gateways, meters:
  - ADD COLUMN `source_type ENUM('REAL','DEMO') DEFAULT 'REAL'` on gateways → succeeds,
    existing rows get DEFAULT 'REAL' (correct for the demo gateway).
  - ADD COLUMN `source_type ENUM('REAL','DEMO') DEFAULT 'REAL'` on meters → succeeds,
    existing rows get DEFAULT 'REAL'.
  - ADD UNIQUE KEY `uq_gateways_id_source (id, source_type)` → succeeds.
  - ADD UNIQUE KEY `uq_meters_id_source (id, source_type)` → succeeds.
  - DROP FK `fk_telemetry_meter` → succeeds (or is skipped if it does not exist).
  - ADD CONSTRAINT `fk_telemetry_meter_source FOREIGN KEY (meter_id, source_type)` →
    succeeds because existing telemetry rows' `source_type` column (added by this migration)
    now defaults to 'REAL', matching the meters' 'REAL' source_type.
  - CREATE TABLE `raw_payloads`, `metric_mappings`, `metric_mapping_history`, `users`,
    `user_sessions` → all succeed.

### Conclusion
No migration splitting needed. 004 is safe to apply on both clean and seeded databases.

---

## H4 — MySQL Version

**MySQL version: 8.0.46** (confirmed by `SELECT VERSION()` on the local development instance).

CHECK constraint violations ARE rejected by MySQL 8.0.46 (confirmed in phase2b-schema.test.ts
test P2B-07: inserting `verification_status = 'VERIFIED'` with NULL evidence throws
`Check constraint 'chk_mm_verified_fields' is violated`).

A dedicated unit test `H4-check-constraint-violation` is added to `database.test.ts`.

---

## H6 — Placeholder Gateway vs Real Gateway

The seed creates a gateway with `code = 'gw_placeholder_01'` and
`name = 'Site gateway (not verified)'`.

**Protection rules:**
1. The real gateway row MUST be inserted with `mac = GATEWAY_MAC` (from env config),
   never from a hard-coded seed value. The seed does NOT insert a MAC.
2. The placeholder gateway has `auth_key_hash = NULL` and `rs485_master_verified = 0`,
   distinguishing it from a real, commissioned gateway which would have non-null auth_key_hash.
3. Bridge service ONLY uses gateways whose `mac` column matches `env.GATEWAY_MAC`. The
   placeholder gateway starts with `mac = NULL` and thus cannot be matched.
4. Tests that need a gateway use the placeholder via its `id`; they do NOT set mac.
5. A real gateway is provisioned by an administrator via the System page (Step 6c), not by seed.

---

## H7 — user_sessions Token Hashing (Design Note for Step 3)

**Decision (Step 1 approved):** The `user_sessions` table stores the session token as the
primary key `id VARCHAR(128)`. Per H7, this MUST be changed to store a SHA-256 (or better,
Argon2) **hash** of the session token, not the token itself.

**Action required in Step 3 (Auth):**
- Generate a cryptographically random session token (32+ bytes / 64+ hex chars).
- Store `SHA256(token)` in `user_sessions.id`.
- The cookie contains the raw token; lookup hashes it before querying the DB.
- Never log the raw token.
- A migration (006 or later) will rename `user_sessions.id` to `token_hash` and add a
  separate `CHAR(36)` surrogate `id` primary key if needed by other FKs.
- This is noted here so it is not forgotten. The current schema stores the raw token
  (as committed in 004) and will be corrected in Step 3 before any auth is wired up.
