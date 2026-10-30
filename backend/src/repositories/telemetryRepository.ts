/**
 * Operational telemetry reads — HARD-CODED source_type = 'REAL'.
 * DEMO rows must never be returned from these functions.
 */
import type { RowDataPacket } from 'mysql2/promise'
import { getAppPool } from '../database/pool.js'
import { badRequest } from '../utils/errors.js'

export type DataStatePhase2a = 'NO_DATA' | 'UNKNOWN'

export interface RealLatestSample {
  load_id: string
  sample_time: string
  active_power_kw: number | null
  current_a: number | null
  voltage_v: number | null
  power_factor: number | null
  frequency_hz: number | null
  reactive_power_kvar: number | null
  apparent_power_kva: number | null
  active_import_kwh: number | null
}

export function assertOperationalSourceType(requested?: string): void {
  if (requested === undefined || requested === null || requested === '') return
  if (requested === 'DEMO') {
    throw badRequest(
      'DEMO_NOT_ALLOWED',
      'Operational routes do not serve DEMO data. source_type=DEMO is rejected.',
    )
  }
  if (requested !== 'REAL') {
    throw badRequest(
      'INVALID_SOURCE_TYPE',
      `Unsupported source_type '${requested}'. Operational routes are REAL-only.`,
    )
  }
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function getLatestRealSampleForLoad(
  loadId: string,
): Promise<RealLatestSample | null> {
  const [rows] = await getAppPool().query<RowDataPacket[]>(
    `SELECT load_id, sample_time, active_power_kw, current_a, voltage_v, power_factor,
            frequency_hz, reactive_power_kvar, apparent_power_kva, active_import_kwh
     FROM telemetry_samples
     WHERE load_id = ? AND source_type = 'REAL'
     ORDER BY sample_time DESC, id DESC
     LIMIT 1`,
    [loadId],
  )
  const row = rows[0]
  if (!row) return null
  return mapSample(row)
}

export async function countRealSamplesForLoads(loadIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  for (const id of loadIds) result.set(id, 0)
  if (loadIds.length === 0) return result

  const placeholders = loadIds.map(() => '?').join(',')
  const [rows] = await getAppPool().query<RowDataPacket[]>(
    `SELECT load_id, COUNT(*) AS cnt
     FROM telemetry_samples
     WHERE source_type = 'REAL' AND load_id IN (${placeholders})
     GROUP BY load_id`,
    loadIds,
  )
  for (const row of rows) {
    result.set(String(row.load_id), Number(row.cnt))
  }
  return result
}

export async function getLatestRealSamplesForSite(
  siteId: string,
): Promise<Map<string, RealLatestSample>> {
  const [rows] = await getAppPool().query<RowDataPacket[]>(
    `SELECT t.load_id, t.sample_time, t.active_power_kw, t.current_a, t.voltage_v, t.power_factor,
            t.frequency_hz, t.reactive_power_kvar, t.apparent_power_kva, t.active_import_kwh
     FROM telemetry_samples t
     INNER JOIN (
       SELECT load_id, MAX(sample_time) AS max_time
       FROM telemetry_samples
       WHERE site_id = ? AND source_type = 'REAL'
       GROUP BY load_id
     ) latest ON latest.load_id = t.load_id AND latest.max_time = t.sample_time
     WHERE t.site_id = ? AND t.source_type = 'REAL'`,
    [siteId, siteId],
  )

  const map = new Map<string, RealLatestSample>()
  for (const row of rows) {
    const sample = mapSample(row)
    // If ties on sample_time, last write wins; acceptable for Phase 2a empty/rare data.
    map.set(sample.load_id, sample)
  }
  return map
}

/** Test helper: count DEMO rows (must not be used by operational services). */
export async function countDemoSamples(): Promise<number> {
  const [rows] = await getAppPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM telemetry_samples WHERE source_type = 'DEMO'`,
  )
  return Number(rows[0]?.cnt ?? 0)
}

function mapSample(row: RowDataPacket): RealLatestSample {
  return {
    load_id: String(row.load_id),
    sample_time: String(row.sample_time),
    active_power_kw: toNullableNumber(row.active_power_kw),
    current_a: toNullableNumber(row.current_a),
    voltage_v: toNullableNumber(row.voltage_v),
    power_factor: toNullableNumber(row.power_factor),
    frequency_hz: toNullableNumber(row.frequency_hz),
    reactive_power_kvar: toNullableNumber(row.reactive_power_kvar),
    apparent_power_kva: toNullableNumber(row.apparent_power_kva),
    active_import_kwh: toNullableNumber(row.active_import_kwh),
  }
}

export function dataStateForSample(sample: RealLatestSample | null): DataStatePhase2a {
  return sample ? 'UNKNOWN' : 'NO_DATA'
}
