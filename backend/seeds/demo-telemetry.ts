/**
 * Explicit DEMO telemetry seed.
 * Refuses to insert source_type=REAL.
 * Not run by migrations. Operational REAL APIs must ignore these rows.
 */
import type { RowDataPacket } from 'mysql2/promise'
import { getMigratePool, closePools } from '../src/database/pool.js'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--real') || args.includes('--source=REAL')) {
    throw new Error(
      'Refusing to seed REAL telemetry. seed:demo-telemetry only inserts source_type=DEMO.',
    )
  }

  const pool = getMigratePool()
  const conn = await pool.getConnection()
  try {
    const [sites] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM sites ORDER BY created_at LIMIT 1',
    )
    const siteId = sites[0] ? String(sites[0].id) : null
    if (!siteId) throw new Error('No site found. Run seed:catalogue first.')

    const [gateways] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM gateways WHERE site_id = ? LIMIT 1',
      [siteId],
    )
    const gatewayId = gateways[0] ? String(gateways[0].id) : null
    if (!gatewayId) throw new Error('No gateway found. Run seed:catalogue first.')

    const [assignments] = await conn.query<RowDataPacket[]>(
      `SELECT a.load_id, a.meter_id, l.code
       FROM load_meter_assignments a
       INNER JOIN loads l ON l.id = a.load_id
       WHERE a.valid_to IS NULL AND l.site_id = ?`,
      [siteId],
    )
    if (assignments.length === 0) {
      throw new Error('No active assignments. Run seed:catalogue first.')
    }

    let inserted = 0
    let seq = 1
    for (const row of assignments) {
      // Explicit DEMO only — never REAL
      const sourceType = 'DEMO' as const
      if (sourceType !== 'DEMO') {
        throw new Error('Invariant violated: DEMO seed attempted non-DEMO source')
      }

      await conn.query(
        `INSERT INTO telemetry_samples (
           site_id, gateway_id, meter_id, load_id, source_type, schema_version,
           sample_time, received_at, sequence, quality,
           active_power_kw, current_a, voltage_v, power_factor, frequency_hz,
           reactive_power_kvar, apparent_power_kva, active_import_kwh, payload_json
         ) VALUES (
           ?, ?, ?, ?, 'DEMO', 'testems.telemetry.v1',
           UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), ?, 'UNKNOWN',
           1.0000, 2.0000, 415.0000, 0.90000, 50.0000,
           NULL, NULL, NULL, NULL
         )
         ON DUPLICATE KEY UPDATE received_at = VALUES(received_at)`,
        [siteId, gatewayId, String(row.meter_id), String(row.load_id), seq],
      )
      inserted += 1
      seq += 1
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          inserted,
          source_type: 'DEMO',
          note: 'DEMO rows only. REAL operational APIs must still return NO_DATA for empty REAL sets.',
        },
        null,
        2,
      ),
    )
  } finally {
    conn.release()
    await closePools()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
