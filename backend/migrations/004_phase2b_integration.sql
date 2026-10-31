-- 004: Phase 2b integration schema
-- Adds raw payload archive with unique deduplication on (gateway_mac, local_server_ts, payload_hash)
-- Adds metric_mappings with 'number' and binary decode types, versioning, and append-only mapping history
-- Adds composite foreign key (meter_id, source_type) enforcing REAL/DEMO isolation at DB level
-- Adds users and user_sessions for authentication
-- Updates telemetry_samples quality to store GAP/DECODE_ERROR (not ephemeral states like LIVE/STALE/OFFLINE)

SET NAMES utf8mb4;
SET SESSION sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- 1. Add source_type and unique constraint to gateways
ALTER TABLE gateways
  ADD COLUMN source_type ENUM('REAL', 'DEMO') NOT NULL DEFAULT 'REAL' AFTER site_id,
  ADD COLUMN mac VARCHAR(32) NULL AFTER code,
  ADD UNIQUE KEY uq_gateways_id_source (id, source_type),
  ADD UNIQUE KEY uq_gateways_mac (mac);

-- 2. Add source_type, unique constraint, and Phase 2b config fields to meters
ALTER TABLE meters
  ADD COLUMN source_type ENUM('REAL', 'DEMO') NOT NULL DEFAULT 'REAL' AFTER site_id,
  ADD COLUMN slave_id SMALLINT NULL AFTER modbus_slave_id,
  ADD COLUMN model_code VARCHAR(64) NULL AFTER model,
  ADD COLUMN modbus_variant_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER model_code,
  ADD COLUMN serial_settings_note TEXT NULL AFTER register_map_ref,
  ADD COLUMN pt_ratio DECIMAL(12,4) NULL AFTER ct_secondary_a,
  ADD UNIQUE KEY uq_meters_id_source (id, source_type);

-- 3. Update telemetry_samples: replace fk with composite foreign key (meter_id, source_type)
-- and add quality_reason and mapping_version.
ALTER TABLE telemetry_samples
  DROP FOREIGN KEY fk_telemetry_meter,
  DROP CHECK chk_telemetry_quality,
  MODIFY COLUMN quality VARCHAR(32) NOT NULL DEFAULT 'OK',
  ADD COLUMN quality_reason VARCHAR(255) NULL AFTER quality,
  ADD COLUMN mapping_version INT NULL AFTER sequence,
  ADD CONSTRAINT chk_telemetry_quality CHECK (quality IN ('OK', 'GAP', 'DECODE_ERROR', 'UNKNOWN', 'LIVE', 'STALE', 'OFFLINE')),
  ADD CONSTRAINT fk_telemetry_meter_source FOREIGN KEY (meter_id, source_type) REFERENCES meters (id, source_type) ON DELETE RESTRICT;

-- 4. Raw payload archive (deduplicated by gateway_mac, local_server_ts, payload_hash)
CREATE TABLE raw_payloads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  gateway_mac VARCHAR(32) NOT NULL,
  local_server_ts BIGINT NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  received_at DATETIME(3) NOT NULL,
  mapping_version INT NOT NULL DEFAULT 1,
  decode_status ENUM('SUCCESS', 'FAILED', 'PARTIAL', 'SKIPPED') NOT NULL DEFAULT 'SUCCESS',
  decode_error TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_raw_payload_dedup (gateway_mac, local_server_ts, payload_hash),
  KEY idx_raw_gateway_ts (gateway_mac, local_server_ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Metric mappings
CREATE TABLE metric_mappings (
  id CHAR(36) NOT NULL,
  meter_id CHAR(36) NOT NULL,
  metric VARCHAR(64) NOT NULL,
  source_keys JSON NOT NULL,
  decode ENUM('number', 'uint16', 'int16', 'uint32', 'int32', 'float32') NOT NULL,
  word_order ENUM('BE', 'LE') NOT NULL DEFAULT 'BE',
  byte_order ENUM('BE', 'LE') NOT NULL DEFAULT 'BE',
  scale DECIMAL(18,6) NOT NULL DEFAULT 1.000000,
  offset DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  unit VARCHAR(32) NOT NULL,
  verification_status ENUM('UNVERIFIED', 'VERIFIED') NOT NULL DEFAULT 'UNVERIFIED',
  verified_by VARCHAR(64) NULL,
  verified_at DATETIME(3) NULL,
  evidence_note TEXT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_metric_mapping_meter_metric (meter_id, metric),
  KEY idx_mm_meter (meter_id),
  CONSTRAINT fk_mm_meter FOREIGN KEY (meter_id) REFERENCES meters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. Append-only metric mapping history
CREATE TABLE metric_mapping_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mapping_id CHAR(36) NOT NULL,
  meter_id CHAR(36) NOT NULL,
  metric VARCHAR(64) NOT NULL,
  source_keys JSON NOT NULL,
  decode ENUM('number', 'uint16', 'int16', 'uint32', 'int32', 'float32') NOT NULL,
  word_order ENUM('BE', 'LE') NOT NULL DEFAULT 'BE',
  byte_order ENUM('BE', 'LE') NOT NULL DEFAULT 'BE',
  scale DECIMAL(18,6) NOT NULL DEFAULT 1.000000,
  offset DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  unit VARCHAR(32) NOT NULL,
  verification_status ENUM('UNVERIFIED', 'VERIFIED') NOT NULL DEFAULT 'UNVERIFIED',
  verified_by VARCHAR(64) NULL,
  verified_at DATETIME(3) NULL,
  evidence_note TEXT NULL,
  version INT NOT NULL,
  action ENUM('CREATED', 'UPDATED', 'DELETED') NOT NULL,
  changed_by VARCHAR(64) NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_mmh_mapping_id (mapping_id),
  KEY idx_mmh_meter_ver (meter_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. Users table for authentication
CREATE TABLE users (
  id CHAR(36) NOT NULL,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 8. User sessions table
CREATE TABLE user_sessions (
  id VARCHAR(128) NOT NULL,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_session_expires (expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
