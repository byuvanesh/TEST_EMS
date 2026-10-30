import type { RowDataPacket } from 'mysql2/promise'
import { getAppPool } from '../database/pool.js'
import { notFound } from '../utils/errors.js'

export interface SiteRow {
  id: string
  code: string
  name: string
  timezone: string
  created_at: string
}

export interface LoadRow {
  id: string
  site_id: string
  code: string
  name: string
  capacity_label: string
  chart_color: string
  sort_order: number
  is_active: number
}

export async function listSites(): Promise<SiteRow[]> {
  const [rows] = await getAppPool().query<RowDataPacket[]>(
    'SELECT id, code, name, timezone, created_at FROM sites ORDER BY code',
  )
  return rows.map(mapSite)
}

export async function getSiteById(siteId: string): Promise<SiteRow> {
  const [rows] = await getAppPool().query<RowDataPacket[]>(
    'SELECT id, code, name, timezone, created_at FROM sites WHERE id = ? LIMIT 1',
    [siteId],
  )
  const row = rows[0]
  if (!row) throw notFound('SITE_NOT_FOUND', `Site '${siteId}' not found`)
  return mapSite(row)
}

export async function listLoads(siteId?: string): Promise<LoadRow[]> {
  if (siteId) {
    await getSiteById(siteId)
    const [rows] = await getAppPool().query<RowDataPacket[]>(
      `SELECT id, site_id, code, name, capacity_label, chart_color, sort_order, is_active
       FROM loads WHERE site_id = ? ORDER BY sort_order`,
      [siteId],
    )
    return rows.map(mapLoad)
  }
  const [rows] = await getAppPool().query<RowDataPacket[]>(
    `SELECT id, site_id, code, name, capacity_label, chart_color, sort_order, is_active
     FROM loads ORDER BY sort_order`,
  )
  return rows.map(mapLoad)
}

export async function getLoadById(loadId: string): Promise<LoadRow> {
  const [rows] = await getAppPool().query<RowDataPacket[]>(
    `SELECT id, site_id, code, name, capacity_label, chart_color, sort_order, is_active
     FROM loads WHERE id = ? LIMIT 1`,
    [loadId],
  )
  const row = rows[0]
  if (!row) throw notFound('LOAD_NOT_FOUND', `Load '${loadId}' not found`)
  return mapLoad(row)
}

export async function getGatewaySummary(siteId: string): Promise<{
  id: string
  code: string
  name: string
  rs485_master_verified: boolean
  auth_key_hash_present: boolean
} | null> {
  const [rows] = await getAppPool().query<RowDataPacket[]>(
    `SELECT id, code, name, rs485_master_verified, auth_key_hash
     FROM gateways WHERE site_id = ? ORDER BY created_at LIMIT 1`,
    [siteId],
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    rs485_master_verified: Boolean(row.rs485_master_verified),
    auth_key_hash_present: row.auth_key_hash != null,
  }
}

function mapSite(row: RowDataPacket): SiteRow {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    timezone: String(row.timezone),
    created_at: String(row.created_at),
  }
}

function mapLoad(row: RowDataPacket): LoadRow {
  return {
    id: String(row.id),
    site_id: String(row.site_id),
    code: String(row.code),
    name: String(row.name),
    capacity_label: String(row.capacity_label),
    chart_color: String(row.chart_color),
    sort_order: Number(row.sort_order),
    is_active: Number(row.is_active),
  }
}
