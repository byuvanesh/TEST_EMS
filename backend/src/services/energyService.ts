/**
 * Energy Analytics Service — Step 5 (Phase 2b)
 *
 * Rules:
 *  - Counter-delta based (active_import_kwh).
 *  - Negative / reset / rollover = GAP not negative energy.
 *  - No demand calculation — meter-reported demand only when VERIFIED.
 */

import type { RowDataPacket } from 'mysql2/promise'
import { getAppPool } from '../database/pool.js'
import { assertOperationalSourceType } from '../repositories/telemetryRepository.js'

export interface EnergyInterval {
  start_time: string
  end_time: string
  start_kwh: number | null
  end_kwh: number | null
  energy_kwh: number | null
  status: 'OK' | 'GAP'
  reason?: string
}

export interface EnergyResult {
  origin_assurance: 'LABEL_ONLY'
  source_type: 'REAL'
  method: 'counter-delta'
  total_energy_kwh: number
  intervals: EnergyInterval[]
  has_gaps: boolean
  demand: {
    availability: 'UNAVAILABLE' | 'AVAILABLE'
    reason_codes: string[]
    value: number | null
  }
}

export async function calculateEnergy(
  loadId?: string,
  siteId?: string,
  requestedSourceType?: string,
): Promise<EnergyResult> {
  assertOperationalSourceType(requestedSourceType)
  const pool = getAppPool()

  let query = `
    SELECT id, load_id, sample_time, active_import_kwh
    FROM telemetry_samples
    WHERE source_type = 'REAL'
  `
  const params: unknown[] = []

  if (loadId) {
    query += ' AND load_id = ?'
    params.push(loadId)
  } else if (siteId) {
    query += ' AND site_id = ?'
    params.push(siteId)
  }

  query += ' ORDER BY load_id ASC, sample_time ASC, id ASC'

  const [rows] = await pool.query<RowDataPacket[]>(query, params)

  // Group by load_id to calculate counter deltas per load
  const loadMap = new Map<string, Array<{ sample_time: string; active_import_kwh: number | null }>>()
  for (const r of rows) {
    const lid = String(r.load_id)
    if (!loadMap.has(lid)) {
      loadMap.set(lid, [])
    }
    loadMap.get(lid)!.push({
      sample_time: String(r.sample_time),
      active_import_kwh: r.active_import_kwh !== null && r.active_import_kwh !== undefined ? Number(r.active_import_kwh) : null,
    })
  }

  const intervals: EnergyInterval[] = []
  let totalEnergy = 0
  let hasGaps = false

  for (const [, samples] of loadMap) {
    for (let i = 0; i < samples.length - 1; i++) {
      const prev = samples[i]!
      const curr = samples[i + 1]!

      if (prev.active_import_kwh === null || curr.active_import_kwh === null) {
        hasGaps = true
        intervals.push({
          start_time: prev.sample_time,
          end_time: curr.sample_time,
          start_kwh: prev.active_import_kwh,
          end_kwh: curr.active_import_kwh,
          energy_kwh: null,
          status: 'GAP',
          reason: 'COUNTER_NULL_OR_UNVERIFIED',
        })
        continue
      }

      const delta = curr.active_import_kwh - prev.active_import_kwh

      // "negative/reset/rollover = GAP not negative energy."
      if (delta < 0) {
        hasGaps = true
        intervals.push({
          start_time: prev.sample_time,
          end_time: curr.sample_time,
          start_kwh: prev.active_import_kwh,
          end_kwh: curr.active_import_kwh,
          energy_kwh: null,
          status: 'GAP',
          reason: 'COUNTER_ROLLOVER_OR_RESET',
        })
      } else {
        const roundedDelta = Number(delta.toFixed(4))
        totalEnergy += roundedDelta
        intervals.push({
          start_time: prev.sample_time,
          end_time: curr.sample_time,
          start_kwh: prev.active_import_kwh,
          end_kwh: curr.active_import_kwh,
          energy_kwh: roundedDelta,
          status: 'OK',
        })
      }
    }
  }

  // "No demand calculation — meter-reported demand only when VERIFIED."
  const demand = {
    availability: 'UNAVAILABLE' as const,
    reason_codes: ['DEMAND_INTERVAL_TBD'],
    value: null,
  }

  return {
    origin_assurance: 'LABEL_ONLY',
    source_type: 'REAL',
    method: 'counter-delta',
    total_energy_kwh: Number(totalEnergy.toFixed(4)),
    intervals,
    has_gaps: hasGaps,
    demand,
  }
}
