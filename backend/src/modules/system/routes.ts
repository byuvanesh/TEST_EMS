import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { RowDataPacket } from 'mysql2/promise'
import { randomUUID } from 'node:crypto'
import { getAppPool } from '../../database/pool.js'
import { authenticate } from '../auth/middleware.js'
import { badRequest, notFound } from '../../utils/errors.js'
import { decodeMetric, type DecodeType, type WordOrder, type ByteOrder, type VerificationStatus } from '../../services/decoder.js'
import { getActiveBridge } from '../../services/bridgeService.js'
import { getEnv } from '../../config/env.js'

const MappingItemSchema = z.object({
  metric: z.string().min(1, 'Metric identifier is required'),
  source_keys: z.array(z.string().min(1)).min(1, 'At least one source key is required'),
  decode: z.enum(['number', 'uint16', 'int16', 'uint32', 'int32', 'float32']),
  word_order: z.enum(['BE', 'LE']).default('BE'),
  byte_order: z.enum(['BE', 'LE']).default('BE'),
  scale: z.coerce.number().default(1.0),
  offset: z.coerce.number().default(0.0),
  unit: z.string().default(''),
  verification_status: z.enum(['UNVERIFIED', 'VERIFIED']).default('UNVERIFIED'),
  verified_by: z.string().nullable().optional(),
  verified_at: z.string().nullable().optional(),
  evidence_note: z.string().nullable().optional(),
})

const PutMappingBodySchema = z.object({
  meter_id: z.string().min(1, 'meter_id is required'),
  mappings: z.array(MappingItemSchema).min(1, 'At least one mapping is required'),
})

const TestMappingBodySchema = z.object({
  meter_id: z.string().optional(),
  gateway_mac: z.string().optional(),
  mapping: MappingItemSchema,
  raw_payload: z.record(z.string(), z.unknown()).optional(),
})

export async function registerSystemRoutes(app: FastifyInstance): Promise<void> {
  // --------------------------------------------------------------------------
  // GET /api/system/mapping — List meters and their active metric mappings
  // --------------------------------------------------------------------------
  app.get('/api/system/mapping', async (_req, reply) => {
    const pool = getAppPool()

    const [meters] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.label, m.source_type, m.slave_id,
              m.model, m.model_code, m.modbus_variant_verified,
              g.id AS gateway_id, g.code AS gateway_code, g.mac AS gateway_mac
       FROM meters m
       LEFT JOIN gateway_meter_links gml ON gml.meter_id = m.id
       LEFT JOIN gateways g ON g.id = gml.gateway_id
       ORDER BY m.id ASC`,
    )

    const [mappings] = await pool.query<RowDataPacket[]>(
      `SELECT id, meter_id, metric, source_keys, decode, word_order, byte_order,
              scale, offset, unit, verification_status, verified_by, verified_at,
              evidence_note, version, created_at, updated_at
       FROM metric_mappings
       ORDER BY meter_id ASC, metric ASC`,
    )

    // Group mappings by meter_id
    const mappingsByMeter = new Map<string, unknown[]>()
    for (const m of mappings) {
      const meterId = m.meter_id as string
      if (!mappingsByMeter.has(meterId)) {
        mappingsByMeter.set(meterId, [])
      }
      mappingsByMeter.get(meterId)!.push({
        id: m.id,
        metric: m.metric,
        source_keys: typeof m.source_keys === 'string' ? JSON.parse(m.source_keys) : m.source_keys,
        decode: m.decode,
        word_order: m.word_order,
        byte_order: m.byte_order,
        scale: Number(m.scale),
        offset: Number(m.offset),
        unit: m.unit,
        verification_status: m.verification_status,
        verified_by: m.verified_by,
        verified_at: m.verified_at,
        evidence_note: m.evidence_note,
        version: m.version,
      })
    }

    const result = meters.map((meter) => ({
      id: meter.id,
      label: meter.label,
      source_type: meter.source_type,
      slave_id: meter.slave_id,
      model: meter.model,
      model_code: meter.model_code,
      modbus_variant_verified: Boolean(meter.modbus_variant_verified),
      gateway: meter.gateway_id
        ? {
            id: meter.gateway_id,
            code: meter.gateway_code,
            mac: meter.gateway_mac,
          }
        : null,
      mappings: mappingsByMeter.get(meter.id as string) ?? [],
    }))

    return reply.status(200).send({ meters: result })
  })

  // --------------------------------------------------------------------------
  // PUT /api/system/mapping — Update metric mappings with versioning & history
  // Strictly requires authentication, password change completed, and CSRF token.
  // --------------------------------------------------------------------------
  app.put(
    '/api/system/mapping',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const parseResult = PutMappingBodySchema.safeParse(req.body)
      if (!parseResult.success) {
        throw badRequest('VALIDATION_ERROR', 'Invalid mapping request body', parseResult.error.format())
      }

      const { meter_id, mappings } = parseResult.data
      const pool = getAppPool()

      // Validate that meter exists
      const [meterRows] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM meters WHERE id = ? LIMIT 1',
        [meter_id],
      )
      if (meterRows.length === 0) {
        throw notFound('METER_NOT_FOUND', `Meter with ID '${meter_id}' not found`)
      }

      // Enforce Migration 005 check: VERIFIED status requires evidence
      for (const item of mappings) {
        if (item.verification_status === 'VERIFIED') {
          if (!item.verified_by || !item.evidence_note || !item.verified_at) {
            throw badRequest(
              'VERIFICATION_EVIDENCE_REQUIRED',
              `Metric '${item.metric}' has verification_status='VERIFIED' but is missing verified_by, verified_at, or evidence_note`,
            )
          }
        }
      }

      const changedBy = req.user?.username ?? 'admin'
      const conn = await pool.getConnection()

      try {
        await conn.beginTransaction()

        for (const item of mappings) {
          const sourceKeysJson = JSON.stringify(item.source_keys)

          // Check if mapping exists
          const [existingRows] = await conn.query<RowDataPacket[]>(
            'SELECT id, version FROM metric_mappings WHERE meter_id = ? AND metric = ? LIMIT 1',
            [meter_id, item.metric],
          )

          let mappingId: string
          let newVersion: number
          let action: 'CREATED' | 'UPDATED'

          if (existingRows.length > 0) {
            mappingId = existingRows[0]!.id as string
            newVersion = (existingRows[0]!.version as number) + 1
            action = 'UPDATED'

            await conn.query(
              `UPDATE metric_mappings
               SET source_keys = ?, decode = ?, word_order = ?, byte_order = ?,
                   scale = ?, offset = ?, unit = ?, verification_status = ?,
                   verified_by = ?, verified_at = ?, evidence_note = ?,
                   version = ?, updated_at = UTC_TIMESTAMP(3)
               WHERE id = ?`,
              [
                sourceKeysJson,
                item.decode,
                item.word_order,
                item.byte_order,
                item.scale,
                item.offset,
                item.unit,
                item.verification_status,
                item.verified_by ?? null,
                item.verified_at ?? null,
                item.evidence_note ?? null,
                newVersion,
                mappingId,
              ],
            )
          } else {
            mappingId = randomUUID()
            newVersion = 1
            action = 'CREATED'

            await conn.query(
              `INSERT INTO metric_mappings
                 (id, meter_id, metric, source_keys, decode, word_order, byte_order,
                  scale, offset, unit, verification_status, verified_by, verified_at,
                  evidence_note, version, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
              [
                mappingId,
                meter_id,
                item.metric,
                sourceKeysJson,
                item.decode,
                item.word_order,
                item.byte_order,
                item.scale,
                item.offset,
                item.unit,
                item.verification_status,
                item.verified_by ?? null,
                item.verified_at ?? null,
                item.evidence_note ?? null,
                newVersion,
              ],
            )
          }

          // Append to append-only metric_mapping_history
          await conn.query(
            `INSERT INTO metric_mapping_history
               (mapping_id, meter_id, metric, source_keys, decode, word_order, byte_order,
                scale, offset, unit, verification_status, verified_by, verified_at,
                evidence_note, version, action, changed_by, changed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
            [
              mappingId,
              meter_id,
              item.metric,
              sourceKeysJson,
              item.decode,
              item.word_order,
              item.byte_order,
              item.scale,
              item.offset,
              item.unit,
              item.verification_status,
              item.verified_by ?? null,
              item.verified_at ?? null,
              item.evidence_note ?? null,
              newVersion,
              action,
              changedBy,
            ],
          )
        }

        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      } finally {
        conn.release()
      }

      return reply.status(200).send({
        ok: true,
        meter_id,
        updatedCount: mappings.length,
      })
    },
  )

  // --------------------------------------------------------------------------
  // POST /api/system/mapping/test — Test decode against latest raw payload
  // Decodes proposed mapping regardless of verification_status (test endpoint).
  // --------------------------------------------------------------------------
  app.post(
    '/api/system/mapping/test',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const parseResult = TestMappingBodySchema.safeParse(req.body)
      if (!parseResult.success) {
        throw badRequest('VALIDATION_ERROR', 'Invalid test mapping request body', parseResult.error.format())
      }

      const { meter_id, gateway_mac, mapping, raw_payload } = parseResult.data
      const pool = getAppPool()

      let payload: Record<string, unknown> | null = null
      let targetMac = gateway_mac
      let localServerTs: number | null = null

      if (raw_payload && typeof raw_payload === 'object') {
        payload = raw_payload
        localServerTs = (raw_payload['_ts'] as number) ?? Date.now()
      } else {
        // Resolve gateway MAC from meter_id if not explicitly provided
        if (!targetMac && meter_id) {
          const [meterRows] = await pool.query<RowDataPacket[]>(
            `SELECT g.mac FROM meters m
             JOIN gateway_meter_links gml ON gml.meter_id = m.id
             JOIN gateways g ON g.id = gml.gateway_id
             WHERE m.id = ? LIMIT 1`,
            [meter_id],
          )
          if (meterRows.length > 0 && meterRows[0]?.mac) {
            targetMac = meterRows[0].mac as string
          }
        }

        if (targetMac) {
          const [payloadRows] = await pool.query<RowDataPacket[]>(
            `SELECT payload_json, local_server_ts
             FROM raw_payloads
             WHERE gateway_mac = ?
             ORDER BY local_server_ts DESC
             LIMIT 1`,
            [targetMac],
          )
          if (payloadRows.length > 0) {
            const raw = payloadRows[0]!
            localServerTs = raw.local_server_ts as number
            payload =
              typeof raw.payload_json === 'string'
                ? (JSON.parse(raw.payload_json) as Record<string, unknown>)
                : (raw.payload_json as Record<string, unknown>)
          }
        }
      }

      if (!payload) {
        return reply.status(200).send({
          ok: false,
          error: 'NO_RAW_PAYLOAD_AVAILABLE',
          message:
            'No raw payload found for this meter/gateway. Either supply a raw_payload object or ingest data first.',
          raw_keys: {},
          decoded_value: null,
        })
      }

      // Collect raw values for the source keys to display side-by-side
      const rawKeys: Record<string, unknown> = {}
      for (const k of mapping.source_keys) {
        rawKeys[k] = payload[k] ?? null
      }

      // Decode with ignoreVerificationStatus: true so UNVERIFIED mappings can be tested
      const decodedValue = decodeMetric(
        {
          metric: mapping.metric,
          source_keys: mapping.source_keys,
          decode: mapping.decode as DecodeType,
          word_order: mapping.word_order as WordOrder,
          byte_order: mapping.byte_order as ByteOrder,
          scale: mapping.scale,
          offset: mapping.offset,
          verification_status: mapping.verification_status as VerificationStatus,
        },
        payload,
        { ignoreVerificationStatus: true },
      )

      return reply.status(200).send({
        ok: true,
        metric: mapping.metric,
        raw_keys: rawKeys,
        decoded_value: decodedValue,
        unit: mapping.unit,
        decode: mapping.decode,
        word_order: mapping.word_order,
        byte_order: mapping.byte_order,
        scale: mapping.scale,
        offset: mapping.offset,
        verification_status: mapping.verification_status,
        local_server_ts: localServerTs,
      })
    },
  )

  // --------------------------------------------------------------------------
  // GET /api/system/gateway — Gateway status from local_server/bridge
  // --------------------------------------------------------------------------
  app.get('/api/system/gateway', async (_req, reply) => {
    const pool = getAppPool()
    const [gwRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, site_id, code, mac, name, firmware_version, rs485_master_verified
       FROM gateways
       WHERE source_type = 'REAL'
       LIMIT 1`,
    )
    const gw = gwRows[0]
    if (!gw) {
      throw notFound('GATEWAY_NOT_FOUND', 'No REAL gateway configured')
    }

    const bridge = getActiveBridge()
    const bridgeStatus = bridge ? bridge.getStatus() : {
      status: 'disabled' as const,
      mode: 'none' as const,
      last_receive_time: null,
    }

    const [meterRows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id AS meter_id, m.label, m.slave_id, m.status, m.modbus_variant_verified
       FROM meters m
       INNER JOIN gateway_meter_links gml ON gml.meter_id = m.id
       WHERE gml.gateway_id = ? AND m.source_type = 'REAL'
       ORDER BY m.id ASC`,
      [gw.id],
    )

    const meters = meterRows.map((m) => ({
      meter_id: m.meter_id,
      label: m.label,
      slave_id: m.slave_id,
      state_assurance: 'gateway-level only' as const,
      status: bridgeStatus.status === 'connected' ? 'online' : 'unknown',
      note: 'Meter state labeled "gateway-level only" until a bench test proves per-meter failure behavior.',
    }))

    return reply.status(200).send({
      gateway: {
        id: gw.id,
        code: gw.code,
        name: gw.name,
        mac: gw.mac,
        firmware_version: gw.firmware_version,
        rs485_master_verified: Boolean(gw.rs485_master_verified),
        status: bridgeStatus.status,
        mode: bridgeStatus.mode,
        last_receive_time: bridgeStatus.last_receive_time,
      },
      meters,
    })
  })

  // --------------------------------------------------------------------------
  // GET /api/system/config — Public-safe system config (auth required)
  // Returns ONLY local_server_url from env — never credentials.
  // LOCAL_SERVER_USER, LOCAL_SERVER_PASSWORD, and GATEWAY_MAC are never
  // returned by this endpoint, by design.
  // --------------------------------------------------------------------------
  app.get(
    '/api/system/config',
    { preHandler: [authenticate] },
    async (_req, reply) => {
      const env = getEnv()
      return reply.status(200).send({
        local_server_url: env.LOCAL_SERVER_URL,
      })
    },
  )
}
