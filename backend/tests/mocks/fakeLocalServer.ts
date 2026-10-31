/**
 * FakeLocalServer — Step 2 test helper
 *
 * An in-process HTTP + WebSocket server that mimics the Trikona local_server
 * API surface used by the bridge client. Does NOT run Python; does not use port 3333.
 *
 * Simulates (all togglable via options):
 *  - Successful login → sets a test session cookie
 *  - GET /api/device/{mac}/latest → returns a snapshot
 *  - WS /ws/live → sends hello, then optionally pushes frames
 *  - Duplicate snapshots (same ts)
 *  - Repeated ts (ts does not advance)
 *  - ts going backwards
 *  - 401 mid-session (after N requests)
 *  - WS close 4401 (unauthorized)
 *  - Malformed JSON response
 *  - Oversize payload
 *  - Slow response (artificial delay)
 *  - Redirect (3xx on /api/device/{mac}/latest)
 *  - Unexpected host requests (tested by client's assertSameOrigin — not by fake server)
 */

import http from 'node:http'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import type { AddressInfo } from 'node:net'

export interface FakeSnapshot {
  ts: number
  payload: Record<string, unknown>
}

export interface FakeLocalServerOptions {
  /** MAC to expect in device paths. Default: 'AA:BB:CC:DD:EE:FF' */
  mac?: string
  /** Initial snapshot to serve. */
  snapshot?: FakeSnapshot
  /** After this many /api/device/.../latest requests, return 401 */
  forceAuthFailAfterN?: number
  /** Return malformed JSON on /api/device/.../latest */
  malformedJson?: boolean
  /** Return a payload of this many bytes (exceeds size limit when > maxPayloadBytes) */
  oversizeBytes?: number
  /** Delay response by this many ms */
  slowMs?: number
  /** Return a redirect on /api/device/.../latest */
  redirectTo?: string
  /** Close WS with code 4401 immediately after connect */
  wsForce4401?: boolean
}

export interface FakeLocalServer {
  /** Base URL, e.g. http://127.0.0.1:PORT */
  baseUrl: string
  /** Normalized MAC to use in paths */
  mac: string
  /** Update the snapshot the server will return */
  setSnapshot(s: FakeSnapshot): void
  /** Force next /latest call to return 401 */
  forceNextAuth401(): void
  /** Push a raw WS message to all connected clients */
  pushWsFrame(frame: Record<string, unknown>): void
  /** Close all WS connections with the given code */
  closeAllWs(code: number): void
  /** Number of times /api/device/.../latest was hit */
  latestHitCount: number
  /** Stop the server */
  stop(): Promise<void>
}

const COOKIE_NAME = 'shiran_session'
const FAKE_TOKEN = 'fake_test_session_token_12345'

export async function startFakeLocalServer(
  opts: FakeLocalServerOptions = {},
): Promise<FakeLocalServer> {
  const mac = (opts.mac ?? 'AA:BB:CC:DD:EE:FF').toUpperCase()
  let snapshot: FakeSnapshot | null = opts.snapshot ?? {
    ts: Date.now(),
    payload: { s1_hold1: 230, s1_hold2: 231 },
  }
  let authFailAfterN = opts.forceAuthFailAfterN ?? -1
  let requestCount = 0
  let force401Next = false
  let latestHitCount = 0

  const connectedWs = new Set<WebSocket>()

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/'

    // --- POST /api/login ---
    if (req.method === 'POST' && url === '/api/login') {
      let body = ''
      req.on('data', (c) => { body += c.toString() })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body) as { username?: string; password?: string }
          // Accept any non-empty credentials
          if (parsed.username && parsed.password) {
            res.setHeader('Set-Cookie', `${COOKIE_NAME}=${FAKE_TOKEN}; HttpOnly; Path=/`)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'auth' }))
          }
        } catch {
          res.writeHead(400)
          res.end()
        }
      })
      return
    }

    // Check session cookie for protected routes
    const cookies = parseCookies(req.headers['cookie'] ?? '')
    const sessionToken = cookies[COOKIE_NAME]
    const authed = sessionToken === FAKE_TOKEN

    // --- GET /api/device/{mac}/latest ---
    const latestMatch = url.match(/^\/api\/device\/([^/?]+)\/latest(\?.*)?$/)
    if (req.method === 'GET' && latestMatch) {
      latestHitCount++
      requestCount++

      // Simulate slow response
      const doRespond = () => {
        if (!authed || force401Next || (authFailAfterN >= 0 && requestCount > authFailAfterN)) {
          force401Next = false
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'auth' }))
          return
        }

        // Redirect simulation
        if (opts.redirectTo) {
          res.writeHead(302, { Location: opts.redirectTo })
          res.end()
          return
        }

        // Malformed JSON
        if (opts.malformedJson) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{ this is not valid json }}}')
          return
        }

        // Oversize payload
        if (opts.oversizeBytes && opts.oversizeBytes > 0) {
          const huge = 'x'.repeat(opts.oversizeBytes)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ device: { id: 1, mac, name: 'test', online: true, last_seen: null, firmware: null }, snapshot: { ts: Date.now(), payload: { data: huge } } }))
          return
        }

        const body = JSON.stringify({
          device: {
            id: 1,
            mac,
            name: 'Fake Gateway',
            online: true,
            last_seen: snapshot?.ts ?? null,
            firmware: 'fake-fw-1.0',
          },
          snapshot: snapshot
            ? { ts: snapshot.ts, payload: snapshot.payload }
            : null,
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(body)
      }

      if (opts.slowMs && opts.slowMs > 0) {
        setTimeout(doRespond, opts.slowMs)
      } else {
        doRespond()
      }
      return
    }

    // --- 404 for everything else ---
    res.writeHead(404)
    res.end()
  })

  // WebSocket server
  const wss = new WebSocketServer({ server })
  wss.on('connection', (ws, req) => {
    const cookies = parseCookies(req.headers['cookie'] ?? '')
    const sessionToken = cookies[COOKIE_NAME]
    const authed = sessionToken === FAKE_TOKEN

    if (!authed || opts.wsForce4401) {
      ws.close(4401, 'Unauthorized')
      return
    }

    connectedWs.add(ws)
    ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }))

    ws.on('close', () => connectedWs.delete(ws))
    ws.on('error', () => connectedWs.delete(ws))

    // Keep-alive: receive pings (local_server does ws.receive_text())
    ws.on('message', () => {
      // echo nothing — just accept
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}`

  return {
    baseUrl,
    mac,
    get latestHitCount() { return latestHitCount },
    setSnapshot(s: FakeSnapshot) {
      snapshot = s
    },
    forceNextAuth401() {
      force401Next = true
    },
    pushWsFrame(frame: Record<string, unknown>) {
      const msg = JSON.stringify(frame)
      for (const ws of connectedWs) {
        try { ws.send(msg) } catch { /* ignore */ }
      }
    },
    closeAllWs(code: number) {
      for (const ws of connectedWs) {
        try { ws.close(code) } catch { /* ignore */ }
      }
      connectedWs.clear()
    },
    stop: () =>
      new Promise((resolve, reject) => {
        wss.close(() => {
          server.close((err) => (err ? reject(err) : resolve()))
        })
      }),
  }
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx < 0) continue
    out[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim()
  }
  return out
}
