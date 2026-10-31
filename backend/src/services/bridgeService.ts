/**
 * BridgeService — Step 2 (Phase 2b)
 *
 * Polls local_server and archives raw payloads to raw_payloads.
 * Decoding and telemetry_samples writes are NOT done in Step 2.
 *
 * Lifecycle:
 *  - start(): login → open WS → poll GET /latest on interval as catch-up
 *  - stop(): close WS, clear timers, close DB connections — tests never hang
 *
 * Rules (from approved Step 2 spec):
 *  - BRIDGE_ENABLED=false → bridge never starts.
 *  - WS reconnect: do a catch-up GET /latest first.
 *  - Freshness uses local_server_ts only. If ts goes backwards or repeats,
 *    log and count it — do NOT overwrite newer data.
 *  - Deduplication: UNIQUE(gateway_mac, local_server_ts, payload_hash).
 *    Duplicate snapshots (same hash) are silently dropped after the first insert.
 *  - Never log cookie, password, or session token.
 *  - Oversize payloads are rejected and counted.
 */

import type { DbPool } from '../database/pool.js'
import { LocalServerClient, LocalServerAuthError, createLocalServerClient } from './localServerClient.js'
import { createHash } from 'node:crypto'
import type { AppEnv } from '../config/env.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BridgeMetrics {
  pollsTotal: number
  pollsOk: number
  pollsError: number
  wsFramesTotal: number
  archiveInserts: number
  archiveDuplicates: number
  archiveOversized: number
  tsReversals: number
  decodeErrors: number
  authErrors: number
}

type Logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => void
  info: (msg: string, ctx?: Record<string, unknown>) => void
  warn: (msg: string, ctx?: Record<string, unknown>) => void
  error: (msg: string, ctx?: Record<string, unknown>) => void
}

// ---------------------------------------------------------------------------
// BridgeService
// ---------------------------------------------------------------------------
export class BridgeService {
  private readonly env: AppEnv
  private readonly pool: DbPool
  private readonly log: Logger
  private client: LocalServerClient | null = null
  private ws: import('ws').WebSocket | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private running = false
  private lastSeenTs: number | null = null
  readonly metrics: BridgeMetrics = {
    pollsTotal: 0,
    pollsOk: 0,
    pollsError: 0,
    wsFramesTotal: 0,
    archiveInserts: 0,
    archiveDuplicates: 0,
    archiveOversized: 0,
    tsReversals: 0,
    decodeErrors: 0,
    authErrors: 0,
  }

  constructor(env: AppEnv, pool: DbPool, log: Logger) {
    this.env = env
    this.pool = pool
    this.log = log
  }

  /** Start the bridge. No-op if BRIDGE_ENABLED=false or already running. */
  async start(): Promise<void> {
    if (!this.env.BRIDGE_ENABLED) {
      this.log.info('BridgeService: BRIDGE_ENABLED=false — bridge will not start')
      return
    }
    if (this.running) return
    this.running = true

    // Never log password
    this.log.info('BridgeService: starting', {
      url: this.env.LOCAL_SERVER_URL,
      mac: this.env.GATEWAY_MAC,
      pollIntervalMs: this.env.LOCAL_SERVER_POLL_INTERVAL_MS,
    })

    this.client = createLocalServerClient(this.env, this.log)

    try {
      // Login — password never logged
      await this.client.login(this.env.LOCAL_SERVER_USER, this.env.LOCAL_SERVER_PASSWORD)
    } catch (err) {
      this.log.error('BridgeService: initial login failed', {
        message: err instanceof Error ? err.message : String(err),
      })
      this.running = false
      return
    }

    // Do an initial catch-up poll before opening WS
    await this.doPoll()

    // Open WebSocket
    this.openWs()

    // Start polling timer as secondary catch-up (detects WS gaps)
    this.pollTimer = setInterval(
      () => void this.doPoll(),
      this.env.LOCAL_SERVER_POLL_INTERVAL_MS,
    )
  }

  /** Stop the bridge cleanly. Closes WS, timers, and releases nothing on the pool (pool owned by app). */
  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false
    this.log.info('BridgeService: stopping')

    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ignore
      }
      this.ws = null
    }

    this.client?.clearSession()
    this.client = null
    this.log.info('BridgeService: stopped')
  }

  // --------------------------------------------------------------------------
  // Internal: polling
  // --------------------------------------------------------------------------
  private async doPoll(): Promise<void> {
    if (!this.client) return
    this.metrics.pollsTotal++

    try {
      const latest = await this.client.fetchLatest()
      this.metrics.pollsOk++

      if (!latest.snapshot) {
        this.log.debug('BridgeService: poll returned no snapshot (device has never posted)')
        return
      }

      const { ts, payload } = latest.snapshot
      await this.archiveSnapshot(ts, payload, 'POLL')
    } catch (err) {
      this.metrics.pollsError++
      if (err instanceof LocalServerAuthError) {
        this.metrics.authErrors++
        this.log.warn('BridgeService: poll got 401 — will re-login on next WS reconnect')
        await this.reLogin()
      } else {
        this.log.warn('BridgeService: poll error', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  // --------------------------------------------------------------------------
  // Internal: WebSocket
  // --------------------------------------------------------------------------
  private openWs(): void {
    if (!this.client || !this.running) return

    this.ws = this.client.openLiveSocket({
      onMessage: (frame) => {
        this.metrics.wsFramesTotal++

        // Ignore the hello frame
        if (frame['type'] === 'hello') return

        // Live frames from /ws/live contain the same payload structure as /api/device/{mac}/latest
        // but wrapped differently. We use GET /latest for authoritative data.
        // For now, WS frames are counted but NOT archived independently to avoid double-archiving.
        // Step 2 only: the frame signals fresh data → trigger a catch-up poll.
        void this.doPoll()
      },
      onAuthError: () => {
        this.metrics.authErrors++
        this.log.warn('BridgeService: WS closed with 4401 — session expired, re-logging in')
        this.ws = null
        void this.reLogin()
      },
      onClose: (code, reason) => {
        this.log.warn('BridgeService: WS closed', { code, reason })
        this.ws = null
        if (this.running) {
          // Do a catch-up poll then reopen WS after a short delay
          setTimeout(() => {
            void this.doPoll().then(() => {
              if (this.running) this.openWs()
            })
          }, 1000)
        }
      },
      onError: (err) => {
        this.log.error('BridgeService: WS error', {
          message: err.message,
        })
        this.ws = null
      },
    })
  }

  // --------------------------------------------------------------------------
  // Internal: re-login after 401
  // --------------------------------------------------------------------------
  private async reLogin(): Promise<void> {
    if (!this.client) return
    try {
      // Password never logged
      await this.client.login(this.env.LOCAL_SERVER_USER, this.env.LOCAL_SERVER_PASSWORD)
      // After re-login, do a catch-up poll then reopen WS
      await this.doPoll()
      if (this.running) this.openWs()
    } catch (err) {
      this.log.error('BridgeService: re-login failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // --------------------------------------------------------------------------
  // Internal: archive a snapshot to raw_payloads
  // --------------------------------------------------------------------------
  async archiveSnapshot(
    localServerTs: number,
    payload: Record<string, unknown>,
    source: 'POLL' | 'WS' = 'POLL',
  ): Promise<'inserted' | 'duplicate' | 'ts-reversal'> {
    const mac = this.env.GATEWAY_MAC

    // Freshness check: if ts goes backwards or repeats, do not overwrite newer data.
    if (this.lastSeenTs !== null && localServerTs <= this.lastSeenTs) {
      this.metrics.tsReversals++
      this.log.warn('BridgeService: local_server ts went backwards or did not advance', {
        current: localServerTs,
        lastSeen: this.lastSeenTs,
        source,
      })
      return 'ts-reversal'
    }

    const payloadJson = JSON.stringify(payload)

    // Oversize guard
    if (Buffer.byteLength(payloadJson, 'utf8') > this.env.LOCAL_SERVER_MAX_PAYLOAD_BYTES) {
      this.metrics.archiveOversized++
      this.log.warn('BridgeService: payload exceeds size limit — rejected', {
        size: Buffer.byteLength(payloadJson),
        limit: this.env.LOCAL_SERVER_MAX_PAYLOAD_BYTES,
      })
      return 'duplicate' // treated as skip
    }

    const payloadHash = createHash('sha256').update(payloadJson, 'utf8').digest('hex')

    try {
      await this.pool.query(
        `INSERT INTO raw_payloads
           (gateway_mac, local_server_ts, payload_hash, payload_json,
            received_at, mapping_version, decode_status)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), 1, 'SUCCESS')`,
        [mac, localServerTs, payloadHash, payloadJson],
      )
      this.lastSeenTs = localServerTs
      this.metrics.archiveInserts++
      this.log.debug('BridgeService: archived snapshot', {
        ts: localServerTs,
        hash: payloadHash.slice(0, 8) + '...',
        source,
      })
      return 'inserted'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // MySQL duplicate key → silently count and return
      if (msg.toLowerCase().includes('duplicate') || msg.includes('uq_raw_payload_dedup')) {
        this.metrics.archiveDuplicates++
        this.log.debug('BridgeService: duplicate snapshot skipped', {
          ts: localServerTs,
          hash: payloadHash.slice(0, 8) + '...',
        })
        return 'duplicate'
      }
      throw err
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createBridgeService(
  env: AppEnv,
  pool: DbPool,
  log: Logger,
): BridgeService {
  return new BridgeService(env, pool, log)
}
