/**
 * Telemetry Pipeline — Step 5 (Phase 2b)
 *
 * Decodes archived raw payloads using active metric mappings and writes
 * decoded samples into telemetry_samples (source_type = 'REAL').
 *
 * Rules:
 *  - Uses decodeMetric() WITHOUT ignoreVerificationStatus (defaults to false).
 *  - UNVERIFIED mappings MUST produce NULL in telemetry_samples (never 0, never skip the row).
 *  - Idempotent on (gateway_id, meter_id, sequence, source_type).
 */

import type { RowDataPacket } from 'mysql2/promise'
import type { DbPool } from '../database/pool.js'
import { decodeMetric, type DecodeType, type WordOrder, type ByteOrder, type VerificationStatus } from './decoder.js'

export interface ProcessRawPayloadResult {
  processed_meters: number
  samples_created: number
  errors: string[]
}

interface MeterLoadRow extends RowDataPacket {
  meter_id: string
  site_id: string
  load_id: string
  gateway_id: string
}

interface MappingRow extends RowDataPacket {
  id: string
  meter_id: string
  metric: string
  source_keys: string | string[]
  decode: DecodeType
  word_order: WordOrder
  byte_order: ByteOrder
  scale: number | string
  offset: number | string
  unit: string
  verification_status: VerificationStatus
  version: number
}

const METRIC_ALIASES: Record<string, string[]> = {
  active_power_kw: ['active_power_kw', 'power_kw', 'power_active', 'active_power'],
  current_a: ['current_a', 'current', 'current_l1'],
  voltage_v: ['voltage_v', 'voltage', 'voltage_l1'],
  power_factor: ['power_factor', 'pf'],
  frequency_hz: ['frequency_hz', 'frequency', 'freq'],
  reactive_power_kvar: ['reactive_power_kvar', 'reactive_power'],
  apparent_power_kva: ['apparent_power_kva', 'apparent_power'],
  active_import_kwh: ['active_import_kwh', 'energy_kwh', 'import_kwh', 'active_energy'],
}

function normalizeMac(mac: string): string {
  return mac.toUpperCase().replace(/[^0-9A-F]/g, (c) => (c === ':' ? ':' : ''))
}

export async function processRawPayload(
  pool: DbPool,
  gatewayMac: string,
  localServerTs: number,
  payload: Record<string, unknown>,
  mappingVersion = 1,
): Promise<ProcessRawPayloadResult> {
  const normMac = normalizeMac(gatewayMac)

  // 1. Resolve gateway by MAC
  const [gwRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, site_id FROM gateways WHERE (mac = ? OR UPPER(REPLACE(mac, ":", "")) = UPPER(REPLACE(?, ":", ""))) AND source_type = "REAL" LIMIT 1',
    [normMac, normMac],
  )
  const gateway = gwRows[0]
  if (!gateway) {
    return { processed_meters: 0, samples_created: 0, errors: [`Gateway not found for MAC ${gatewayMac}`] }
  }
  const gatewayId = String(gateway.id)

  // 2. Resolve all meters linked to this gateway that have an active load assignment
  const [meters] = await pool.query<MeterLoadRow[]>(
    `SELECT m.id AS meter_id, m.site_id, lma.load_id, gml.gateway_id
     FROM meters m
     INNER JOIN gateway_meter_links gml ON gml.meter_id = m.id
     INNER JOIN load_meter_assignments lma ON lma.meter_id = m.id AND lma.valid_to IS NULL
     WHERE gml.gateway_id = ? AND m.source_type = 'REAL'`,
    [gatewayId],
  )

  if (meters.length === 0) {
    return { processed_meters: 0, samples_created: 0, errors: [] }
  }

  // 3. Format sample timestamp from local_server_ts
  const sampleDate = new Date(localServerTs)
  const sampleTime = Number.isNaN(sampleDate.getTime())
    ? new Date().toISOString().slice(0, 23).replace('T', ' ')
    : sampleDate.toISOString().slice(0, 23).replace('T', ' ')
  const sequence = BigInt(localServerTs)
  const payloadJson = JSON.stringify(payload)

  let samplesCreated = 0
  const errors: string[] = []

  // 4. For each meter, retrieve its mappings and decode metrics
  for (const m of meters) {
    const meterId = m.meter_id
    const loadId = m.load_id
    const siteId = m.site_id

    const [mappingRows] = await pool.query<MappingRow[]>(
      `SELECT id, meter_id, metric, source_keys, decode, word_order, byte_order,
              scale, offset, unit, verification_status, version
       FROM metric_mappings
       WHERE meter_id = ?`,
      [meterId],
    )

    // Build map of decoded measurements
    const measurements: Record<string, number | null> = {
      active_power_kw: null,
      current_a: null,
      voltage_v: null,
      power_factor: null,
      frequency_hz: null,
      reactive_power_kvar: null,
      apparent_power_kva: null,
      active_import_kwh: null,
    }

    let maxVersion = mappingVersion
    let hasAnyNonNull = false

    for (const [colName, aliases] of Object.entries(METRIC_ALIASES)) {
      const mapping = mappingRows.find((r) =>
        aliases.includes(r.metric.toLowerCase()) || r.metric.toLowerCase() === colName.toLowerCase(),
      )

      if (mapping) {
        if (mapping.version > maxVersion) {
          maxVersion = mapping.version
        }

        const sourceKeys = Array.isArray(mapping.source_keys)
          ? mapping.source_keys
          : typeof mapping.source_keys === 'string'
            ? (JSON.parse(mapping.source_keys) as string[])
            : []

        // CRITICAL: ignoreVerificationStatus is intentionally NOT passed.
        // It defaults to false. UNVERIFIED mappings strictly produce null.
        const decoded = decodeMetric(
          {
            metric: mapping.metric,
            source_keys: sourceKeys,
            decode: mapping.decode,
            word_order: mapping.word_order ?? 'BE',
            byte_order: mapping.byte_order ?? 'BE',
            scale: Number(mapping.scale ?? 1.0),
            offset: Number(mapping.offset ?? 0.0),
            unit: mapping.unit ?? '',
            verification_status: mapping.verification_status,
          },
          payload,
        )

        measurements[colName] = decoded
        if (decoded !== null) {
          hasAnyNonNull = true
        }
      }
    }

    const quality = hasAnyNonNull ? 'OK' : 'UNKNOWN'

    // 5. Insert decoded sample into telemetry_samples (always write row, even if all measurements are null)
    try {
      await pool.query(
        `INSERT INTO telemetry_samples (
           site_id, gateway_id, meter_id, load_id, source_type, schema_version,
           sample_time, received_at, sequence, quality, quality_reason, mapping_version,
           active_power_kw, current_a, voltage_v, power_factor, frequency_hz,
           reactive_power_kvar, apparent_power_kva, active_import_kwh, payload_json
         ) VALUES (
           ?, ?, ?, ?, 'REAL', 'testems.telemetry.v1',
           ?, UTC_TIMESTAMP(3), ?, ?, NULL, ?,
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?
         ) ON DUPLICATE KEY UPDATE
           active_power_kw = VALUES(active_power_kw),
           current_a = VALUES(current_a),
           voltage_v = VALUES(voltage_v),
           power_factor = VALUES(power_factor),
           frequency_hz = VALUES(frequency_hz),
           reactive_power_kvar = VALUES(reactive_power_kvar),
           apparent_power_kva = VALUES(apparent_power_kva),
           active_import_kwh = VALUES(active_import_kwh),
           quality = VALUES(quality),
           mapping_version = VALUES(mapping_version)`,
        [
          siteId,
          gatewayId,
          meterId,
          loadId,
          sampleTime,
          sequence,
          quality,
          maxVersion,
          measurements['active_power_kw'],
          measurements['current_a'],
          measurements['voltage_v'],
          measurements['power_factor'],
          measurements['frequency_hz'],
          measurements['reactive_power_kvar'],
          measurements['apparent_power_kva'],
          measurements['active_import_kwh'],
          payloadJson,
        ],
      )
      samplesCreated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to insert sample for meter ${meterId}: ${msg}`)
    }
  }

  return {
    processed_meters: meters.length,
    samples_created: samplesCreated,
    errors,
  }
}
