/**
 * Catalogue seed — sites, loads, meters, gateway placeholders.
 * Does NOT insert telemetry. Does NOT invent Modbus/CT/register values.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { closePools, getMigratePool } from '../src/database/pool.js'
import { newId } from '../src/utils/ids.js'

const SITE_CODE = 'SITE-DEMO-01'

const LOADS = [
  { code: 'AC-01', name: 'AC-01', capacity_label: '5 TR', chart_color: '#3B82F6', sort_order: 1 },
  { code: 'AC-02', name: 'AC-02', capacity_label: '5 TR', chart_color: '#0D9488', sort_order: 2 },
  { code: 'AC-03', name: 'AC-03', capacity_label: '8 TR', chart_color: '#7C3AED', sort_order: 3 },
  {
    code: 'Compressor-01',
    name: 'Compressor-01',
    capacity_label: 'Capacity TBD',
    chart_color: '#DB2777',
    sort_order: 4,
  },
] as const

export async function seedCatalogue(): Promise<{ siteId: string; loadCodes: string[] }> {
  const pool = getMigratePool()
  const conn = await pool.getConnection()

  try {
    const [existingSites] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM sites WHERE code = ? LIMIT 1',
      [SITE_CODE],
    )
    let siteId = existingSites[0] ? String(existingSites[0].id) : null

    if (!siteId) {
      siteId = newId()
      await conn.query<ResultSetHeader>(
        `INSERT INTO sites (id, code, name, timezone, created_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [siteId, SITE_CODE, 'TEST_EMS Demo Site', 'Asia/Kolkata'],
      )
    }

    for (const load of LOADS) {
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM loads WHERE site_id = ? AND code = ? LIMIT 1',
        [siteId, load.code],
      )
      if (rows[0]) continue
      await conn.query(
        `INSERT INTO loads
          (id, site_id, code, name, capacity_label, chart_color, sort_order, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, UTC_TIMESTAMP(3))`,
        [
          newId(),
          siteId,
          load.code,
          load.name,
          load.capacity_label,
          load.chart_color,
          load.sort_order,
        ],
      )
    }

    const [loadRows] = await conn.query<RowDataPacket[]>(
      'SELECT id, code FROM loads WHERE site_id = ? ORDER BY sort_order',
      [siteId],
    )

    const [gwRows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM gateways WHERE code = ? LIMIT 1',
      ['gw_placeholder_01'],
    )
    let gatewayId = gwRows[0] ? String(gwRows[0].id) : null
    if (!gatewayId) {
      gatewayId = newId()
      await conn.query(
        `INSERT INTO gateways
          (id, site_id, code, name, auth_key_hash, firmware_version, rs485_master_verified, created_at)
         VALUES (?, ?, ?, ?, NULL, NULL, 0, UTC_TIMESTAMP(3))`,
        [gatewayId, siteId, 'gw_placeholder_01', 'Site gateway (not verified)'],
      )
    }

    for (const load of loadRows) {
      const loadId = String(load.id)
      const code = String(load.code)
      const [meterExisting] = await conn.query<RowDataPacket[]>(
        `SELECT m.id
         FROM meters m
         INNER JOIN load_meter_assignments a ON a.meter_id = m.id AND a.valid_to IS NULL
         WHERE a.load_id = ?
         LIMIT 1`,
        [loadId],
      )
      if (meterExisting[0]) continue

      const meterId = newId()
      await conn.query(
        `INSERT INTO meters
          (id, site_id, label, manufacturer, model, serial_number,
           modbus_slave_id, ct_primary_a, ct_secondary_a, wiring, register_map_ref,
           capability_json, status, created_at)
         VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'planned', UTC_TIMESTAMP(3))`,
        [meterId, siteId, `Meter placeholder for ${code}`],
      )
      await conn.query(
        `INSERT INTO load_meter_assignments (id, load_id, meter_id, valid_from, valid_to)
         VALUES (?, ?, ?, UTC_TIMESTAMP(3), NULL)`,
        [newId(), loadId, meterId],
      )
      await conn.query(
        `INSERT INTO gateway_meter_links (id, gateway_id, meter_id, bus_address_note, created_at)
         VALUES (?, ?, ?, NULL, UTC_TIMESTAMP(3))`,
        [newId(), gatewayId, meterId],
      )
    }

    return { siteId, loadCodes: LOADS.map((l) => l.code) }
  } finally {
    conn.release()
  }
}

async function main(): Promise<void> {
  const result = await seedCatalogue()
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
        note: 'Catalogue only. No telemetry. Slave IDs/CT/registers NULL. rs485_master_verified=false. auth_key_hash=NULL.',
      },
      null,
      2,
    ),
  )
}

const isDirectRun = process.argv[1]?.includes('catalogue')
if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exitCode = 1
    })
    .finally(async () => {
      await closePools()
    })
}
