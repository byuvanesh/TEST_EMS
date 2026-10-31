-- 005: Metric mapping verification guard
-- Enforces CHECK constraint: verification_status = 'VERIFIED' requires verified_by, verified_at, and evidence_note to be non-null
-- UNIQUE(meter_id, metric) was created in 004 as uq_metric_mapping_meter_metric

SET NAMES utf8mb4;
SET SESSION sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

ALTER TABLE metric_mappings
  ADD CONSTRAINT chk_mm_verified_fields
  CHECK (
    verification_status != 'VERIFIED' OR (
      verified_by IS NOT NULL AND
      verified_at IS NOT NULL AND
      evidence_note IS NOT NULL AND
      CHAR_LENGTH(TRIM(evidence_note)) > 0
    )
  );
