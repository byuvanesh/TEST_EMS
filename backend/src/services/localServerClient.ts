/**
 * LocalServerClient — Step 2 (Phase 2b)
 *
 * Read-only HTTP + WebSocket client for the Trikona local_server.
 *
 * Security rules (from approved Step 2 spec):
 *  1. Deny-by-default allowlist: only whitelisted method+path patterns are permitted.
 *     {mac} in a path MUST equal GATEWAY_MAC exactly (normalized, uppercase).
 *  2. Redirects are never followed (redirect: 'error' / manual).
 *  3. No other host is allowed (origin-lock via URL parse check).
 *  4. Every HTTP call has a configurable timeout.
 *  5. Retries use exponential backoff with full jitter, capped at maxRetries.
 *  6. Response + payload size are capped at LOCAL_SERVER_MAX_PAYLOAD_BYTES.
 *  7. Cookie/password/session token are NEVER logged.
 *
 * API shape (confirmed from local_server app.py source):
 *  - POST /api/login            → sets cookie
 *  - GET  /api/device/{mac}/latest  → {device:{...}, snapshot:{ts, payload:{...}}}
 *  - WS   /ws/live              → pushes live frames
 *
 * Freshness: local_server timestamps are ms-epoch integers from db.now().
 * We always use local_server_ts for deduplication; never the TEST_EMS poll time.
 */

import http from 'node:http'
import https from 'node:https'
import { createHash } from 'node:crypto'
import WebSocket from 'ws'
import type { AppEnv } from '../config/env.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LatestSnapshot {
  device: {
    id: number
    mac: string
    name: string
    online: boolean
    last_seen: number | null
    firmware: string | null
  }
  /** The raw snapshot, or null if the device has never posted data. */
  snapshot: { ts: number; payload: Record<string, unknown> } | null
}

export interface LoginResult {
  /** The raw session cookie string to use in subsequent requests. */
  cookie: string
}

export type WsLiveFrame = Record<string, unknown>

export interface LocalServerClientOptions {
  baseUrl: string
  /** MAC that all device-specific requests must target. */
  gatewayMac: string
  timeoutMs: number
  maxPayloadBytes: number
  maxRetries: number
  /** Logger that MUST NOT log secrets. */
  log: {
    debug: (msg: string, ctx?: Record<string, unknown>) => void
    info: (msg: string, ctx?: Record<string, unknown>) => void
    warn: (msg: string, ctx?: Record<string, unknown>) => void
    error: (msg: string, ctx?: Record<string, unknown>) => void
  }
}

// ---------------------------------------------------------------------------
// Allowlist: exact method + path-template pairs
// ---------------------------------------------------------------------------
const ALLOWED_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: 'POST', pattern: /^\/api\/login$/ },
  { method: 'GET',  pattern: /^\/api\/device\/[^/]+\/latest$/ },
  { method: 'GET',  pattern: /^\/api\/device\/[^/]+\/history$/ },
  { method: 'GET',  pattern: /^\/health$/ },
]

function normalizeMac(mac: string): string {
  return mac.toUpperCase().replace(/[^0-9A-F]/g, (c) => (c === ':' ? ':' : ''))
}

function assertAllowed(method: string, urlPath: string): void {
  const allowed = ALLOWED_ROUTES.some(
    (r) => r.method === method && r.pattern.test(urlPath),
  )
  if (!allowed) {
    throw new Error(`LocalServerClient: request denied (not in allowlist): ${method} ${urlPath}`)
  }
}

function assertMacMatch(urlPath: string, expectedMac: string): void {
  // Extract mac segment from paths like /api/device/<mac>/latest
  const m = urlPath.match(/\/api\/device\/([^/]+)\//)
  if (!m) return // no mac in path (e.g. /api/login)
  const pathMac = normalizeMac(m[1] ?? '')
  const cfgMac = normalizeMac(expectedMac)
  if (pathMac !== cfgMac) {
    throw new Error(
      `LocalServerClient: MAC mismatch — request MAC '${pathMac}' !== configured GATEWAY_MAC '${cfgMac}'`,
    )
  }
}

function assertSameOrigin(requestUrl: URL, baseUrl: URL): void {
  if (requestUrl.origin !== baseUrl.origin) {
    throw new Error(
      `LocalServerClient: request to unexpected host '${requestUrl.origin}' — expected '${baseUrl.origin}'`,
    )
  }
}

// ---------------------------------------------------------------------------
// Retry helpers
// ---------------------------------------------------------------------------
function jitteredBackoff(attempt: number, baseMs = 200, capMs = 10_000): number {
  const exp = Math.min(baseMs * 2 ** attempt, capMs)
  return Math.random() * exp
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Payload size guard
// ---------------------------------------------------------------------------
function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// LocalServerClient
// ---------------------------------------------------------------------------
export class LocalServerClient {
  private readonly baseUrl: URL
  private readonly opts: LocalServerClientOptions
  /** The current session cookie. Redacted in all logs. */
  private cookie: string | null = null

  constructor(opts: LocalServerClientOptions) {
    this.opts = opts
    this.baseUrl = new URL(opts.baseUrl)
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Log in and store the session cookie. Throws on failure. */
  async login(username: string, password: string): Promise<void> {
    // Never log username or password
    this.opts.log.info('LocalServerClient: logging in', { url: this.baseUrl.host })
    const body = JSON.stringify({ username, password })
    const res = await this.request('POST', '/api/login', {
      body,
      headers: { 'Content-Type': 'application/json' },
      retries: 2,
    })
    if (res.status === 401) {
      throw new Error('LocalServerClient: login failed (401 Unauthorized)')
    }
    if (res.status !== 200) {
      throw new Error(`LocalServerClient: login failed (HTTP ${res.status})`)
    }
    const setCookie = res.headers['set-cookie']
    if (!setCookie || (Array.isArray(setCookie) && setCookie.length === 0)) {
      throw new Error('LocalServerClient: login succeeded but no cookie was set')
    }
    const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
    // Store only the name=value part, not the attributes
    this.cookie = (rawCookie ?? '').split(';')[0] ?? ''
    // NEVER log cookie value
    this.opts.log.info('LocalServerClient: login successful')
  }

  /** Fetch the latest snapshot for the configured GATEWAY_MAC. */
  async fetchLatest(): Promise<LatestSnapshot> {
    const mac = normalizeMac(this.opts.gatewayMac)
    const path = `/api/device/${mac}/latest`
    const res = await this.request('GET', path, { retries: 3 })
    if (res.status === 401) {
      throw new LocalServerAuthError('fetchLatest: 401 Unauthorized — session expired')
    }
    if (res.status === 404) {
      throw new Error(`LocalServerClient: device not found (MAC=${mac})`)
    }
    if (res.status !== 200) {
      throw new Error(`LocalServerClient: fetchLatest failed (HTTP ${res.status})`)
    }
    const data = JSON.parse(res.body) as LatestSnapshot
    return data
  }

  /**
   * Open a WebSocket to /ws/live.
   * Returns the WebSocket instance. Caller must handle events and close.
   * Throws LocalServerAuthError on close code 4401.
   */
  openLiveSocket(handlers: {
    onMessage: (frame: WsLiveFrame) => void
    onAuthError: () => void
    onClose: (code: number, reason: string) => void
    onError: (err: Error) => void
  }): WebSocket {
    const wsUrl = new URL('/ws/live', this.opts.baseUrl)
    wsUrl.protocol = wsUrl.protocol.replace('http', 'ws')

    // Pass cookie as header — the local_server reads it from ws.cookies
    const headers: Record<string, string> = {}
    if (this.cookie) {
      headers['Cookie'] = this.cookie // NEVER log this
    }

    const ws = new WebSocket(wsUrl.toString(), {
      headers,
      followRedirects: false,
      handshakeTimeout: this.opts.timeoutMs,
    })

    ws.on('message', (data) => {
      try {
        const frame = JSON.parse(data.toString()) as WsLiveFrame
        handlers.onMessage(frame)
      } catch {
        this.opts.log.warn('LocalServerClient: received unparseable WS frame')
      }
    })

    ws.on('close', (code, reasonBuf) => {
      const reason = reasonBuf.toString()
      if (code === 4401) {
        handlers.onAuthError()
        return
      }
      handlers.onClose(code, reason)
    })

    ws.on('error', (err) => {
      handlers.onError(err)
    })

    return ws
  }

  /** Compute payload hash for deduplication. */
  static payloadHash(payloadJson: string): string {
    return sha256Hex(payloadJson)
  }

  /** Clear stored session cookie (e.g., on shutdown). */
  clearSession(): void {
    this.cookie = null
  }

  // --------------------------------------------------------------------------
  // Private HTTP transport
  // --------------------------------------------------------------------------
  private async request(
    method: string,
    urlPath: string,
    options: {
      body?: string
      headers?: Record<string, string>
      retries?: number
    } = {},
  ): Promise<{ status: number; headers: Record<string, string | string[]>; body: string }> {
    const { body, headers: extraHeaders = {}, retries = 0 } = options

    // Security checks
    const fullUrl = new URL(urlPath, this.baseUrl)
    assertSameOrigin(fullUrl, this.baseUrl)
    assertAllowed(method, urlPath)
    assertMacMatch(urlPath, this.opts.gatewayMac)

    const reqHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...extraHeaders,
    }
    // Inject session cookie (NEVER log the value)
    if (this.cookie && !urlPath.includes('/login')) {
      reqHeaders['Cookie'] = this.cookie
    }
    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(body).toString()
    }

    let lastErr: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        const delay = jitteredBackoff(attempt - 1)
        this.opts.log.debug(`LocalServerClient: retry attempt ${attempt} after ${delay.toFixed(0)}ms`, {
          method,
          path: urlPath,
        })
        await sleep(delay)
      }

      try {
        return await this.doRequest(method, fullUrl, reqHeaders, body)
      } catch (err) {
        lastErr = err
        const isAuthErr = err instanceof LocalServerAuthError
        if (isAuthErr) throw err // never retry auth errors
      }
    }
    throw lastErr
  }

  private doRequest(
    method: string,
    url: URL,
    headers: Record<string, string>,
    body?: string,
  ): Promise<{ status: number; headers: Record<string, string | string[]>; body: string }> {
    return new Promise((resolve, reject) => {
      const transport = url.protocol === 'https:' ? https : http
      const options: http.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers,
        // Never follow redirects
        timeout: this.opts.timeoutMs,
      }

      const req = transport.request(options, (res) => {
        // Refuse redirects
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400
        ) {
          res.destroy()
          reject(new Error(`LocalServerClient: redirect refused (HTTP ${res.statusCode})`))
          return
        }

        let raw = ''
        let totalBytes = 0

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length
          if (totalBytes > this.opts.maxPayloadBytes) {
            res.destroy()
            reject(
              new Error(
                `LocalServerClient: response too large (> ${this.opts.maxPayloadBytes} bytes)`,
              ),
            )
            return
          }
          raw += chunk.toString('utf8')
        })

        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[]>,
            body: raw,
          })
        })

        res.on('error', reject)
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`LocalServerClient: request timed out after ${this.opts.timeoutMs}ms`))
      })

      req.on('error', reject)

      if (body) {
        req.write(body)
      }
      req.end()
    })
  }
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------
export class LocalServerAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocalServerAuthError'
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createLocalServerClient(
  env: AppEnv,
  log: LocalServerClientOptions['log'],
): LocalServerClient {
  return new LocalServerClient({
    baseUrl: env.LOCAL_SERVER_URL,
    gatewayMac: env.GATEWAY_MAC,
    timeoutMs: env.LOCAL_SERVER_TIMEOUT_MS,
    maxPayloadBytes: env.LOCAL_SERVER_MAX_PAYLOAD_BYTES,
    maxRetries: 3,
    log,
  })
}
