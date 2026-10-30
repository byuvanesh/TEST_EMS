# TEST_EMS Database Schema — Phase 2a

**Engine:** MySQL 8.x, InnoDB, utf8mb4  
**Database:** `test_ems` (dedicated; not shared with other EMS projects)

## Tables

| Table | Purpose |
|-------|---------|
| `schema_migrations` | Version + SHA-256 checksum |
| `sites` | Site catalogue |
| `loads` | Four confirmed loads |
| `meters` | Placeholder meters; Modbus/CT/register fields NULL |
| `load_meter_assignments` | Meter↔load; `active_load_id` generated column + UNIQUE |
| `gateways` | Placeholder gateway; `rs485_master_verified=0`; `auth_key_hash` NULL |
| `gateway_meter_links` | Gateway↔meter |
| `telemetry_samples` | Optional; `source_type` REAL\|DEMO; for isolation tests |

## Active assignment uniqueness

```sql
active_load_id CHAR(36)
  GENERATED ALWAYS AS (CASE WHEN valid_to IS NULL THEN load_id ELSE NULL END) STORED,
UNIQUE KEY uq_lma_one_active_per_load (active_load_id)
```

Historical date-range overlap is **not** fully prevented.

## Migrations

1. `001_schema_migrations_bootstrap.sql`  
2. `002_core_catalogue.sql`  
3. `003_telemetry_samples.sql`  

Runner: checksum verification, `GET_LOCK` concurrency guard, clear failure messages.
