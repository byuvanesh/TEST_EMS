-- 002: Reduced Phase 2a catalogue schema (sites, loads, meters, assignments, gateways, links)
-- Timestamps are application/UTC wall stored in DATETIME(3).
-- Does not invent Modbus addresses, CT ratios, or verified gateway capability.

SET NAMES utf8mb4;
SET SESSION sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE TABLE sites (
  id CHAR(36) NOT NULL,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sites_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE loads (
  id CHAR(36) NOT NULL,
  site_id CHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  capacity_label VARCHAR(64) NOT NULL,
  chart_color CHAR(7) NOT NULL,
  sort_order INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_loads_site_code (site_id, code),
  KEY idx_loads_site (site_id),
  CONSTRAINT fk_loads_site FOREIGN KEY (site_id) REFERENCES sites (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE meters (
  id CHAR(36) NOT NULL,
  site_id CHAR(36) NOT NULL,
  label VARCHAR(128) NOT NULL,
  manufacturer VARCHAR(64) NULL,
  model VARCHAR(64) NULL,
  serial_number VARCHAR(64) NULL,
  modbus_slave_id SMALLINT NULL,
  ct_primary_a DECIMAL(12,3) NULL,
  ct_secondary_a DECIMAL(12,3) NULL,
  wiring VARCHAR(32) NULL,
  register_map_ref VARCHAR(128) NULL,
  capability_json JSON NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_meters_site (site_id),
  CONSTRAINT fk_meters_site FOREIGN KEY (site_id) REFERENCES sites (id),
  CONSTRAINT chk_meters_status CHECK (status IN ('planned','installed','active','retired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE load_meter_assignments (
  id CHAR(36) NOT NULL,
  load_id CHAR(36) NOT NULL,
  meter_id CHAR(36) NOT NULL,
  valid_from DATETIME(3) NOT NULL,
  valid_to DATETIME(3) NULL,
  active_load_id CHAR(36)
    GENERATED ALWAYS AS (CASE WHEN valid_to IS NULL THEN load_id ELSE NULL END) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lma_one_active_per_load (active_load_id),
  KEY idx_lma_meter (meter_id),
  KEY idx_lma_load_from (load_id, valid_from),
  CONSTRAINT fk_lma_load FOREIGN KEY (load_id) REFERENCES loads (id),
  CONSTRAINT fk_lma_meter FOREIGN KEY (meter_id) REFERENCES meters (id),
  CONSTRAINT chk_lma_valid_range CHECK (valid_to IS NULL OR valid_to >= valid_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- NOTE: Historical date-range overlap is NOT fully prevented by this schema.
-- Only one *active* (valid_to IS NULL) assignment per load is enforced.

CREATE TABLE gateways (
  id CHAR(36) NOT NULL,
  site_id CHAR(36) NOT NULL,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  auth_key_hash VARCHAR(255) NULL,
  firmware_version VARCHAR(64) NULL,
  rs485_master_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gateways_code (code),
  KEY idx_gateways_site (site_id),
  CONSTRAINT fk_gateways_site FOREIGN KEY (site_id) REFERENCES sites (id),
  CONSTRAINT chk_gateways_verified CHECK (rs485_master_verified IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE gateway_meter_links (
  id CHAR(36) NOT NULL,
  gateway_id CHAR(36) NOT NULL,
  meter_id CHAR(36) NOT NULL,
  bus_address_note VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gml_gateway_meter (gateway_id, meter_id),
  KEY idx_gml_meter (meter_id),
  CONSTRAINT fk_gml_gateway FOREIGN KEY (gateway_id) REFERENCES gateways (id),
  CONSTRAINT fk_gml_meter FOREIGN KEY (meter_id) REFERENCES meters (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
