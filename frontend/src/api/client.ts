/**
 * Typed API Client for TEST_EMS backend.
 *
 * Requirements:
 * - Credentials included on all requests (for session cookie ems_session)
 * - Sends and receives CSRF token from login / getMe
 * - Attaches X-CSRF-Token on state-changing requests (POST, PUT, DELETE, PATCH)
 * - Never coerces null to 0
 */

export interface ApiUser {
  id: string
  username: string
  role: 'admin' | 'viewer'
  mustChangePassword: boolean
}

export interface AuthLoginResponse {
  user: ApiUser
  csrfToken: string
}

export interface AuthMeResponse {
  user: ApiUser
  csrfToken: string
}

export interface ChangePasswordResponse {
  ok: boolean
  mustChangePassword: boolean
}

export interface ApiCatalogueLoad {
  id: string
  site_id: string
  code: string
  name: string
  capacity_label: string
  chart_color: string
  sort_order: number
  is_active: boolean
}

export interface ApiLoadsResponse {
  origin_assurance: 'LABEL_ONLY'
  source_type: 'REAL'
  loads: ApiCatalogueLoad[]
}

export interface ApiElectricalMeasurements {
  active_power_kw: number | null
  current_a: number | null
  voltage_v: number | null
  power_factor: number | null
  frequency_hz: number | null
  reactive_power_kvar: number | null
  apparent_power_kva: number | null
  active_import_kwh: number | null
}

export interface ApiOverviewLoad {
  load_id: string
  code: string
  name: string
  capacity_label: string
  chart_color: string
  data_state: 'NO_DATA' | 'UNKNOWN' | 'LIVE' | 'STALE' | 'OFFLINE'
  as_of: string | null
  measurements: ApiElectricalMeasurements
}

export interface ApiGatewayStatus {
  id: string
  code: string
  name: string
  rs485_master_verified: number
  auth_configured: boolean
  link_state: 'online' | 'degraded' | 'offline' | 'unknown'
  note: string
}

export interface ApiOverviewResponse {
  origin_assurance: 'LABEL_ONLY'
  source_type: 'REAL'
  data_state: 'NO_DATA' | 'UNKNOWN' | 'LIVE' | 'STALE' | 'OFFLINE'
  as_of: string | null
  loads_expected: number
  loads_reporting: number
  total_active_power_kw: number | null
  incomplete: boolean
  missing_loads: string[]
  aggregate_pf: number | null
  site: {
    id: string
    code: string
    name: string
    timezone: string
  }
  loads: ApiOverviewLoad[]
  gateway: ApiGatewayStatus | null
  analytics: Record<string, unknown>
  power_series: unknown[]
  top_alarms: unknown[]
}

export interface ApiLoadDetailResponse {
  origin_assurance: 'LABEL_ONLY'
  source_type: 'REAL'
  data_state: 'NO_DATA' | 'UNKNOWN' | 'LIVE' | 'STALE' | 'OFFLINE'
  as_of: string | null
  load: {
    id: string
    site_id: string
    code: string
    name: string
    capacity_label: string
    chart_color: string
  }
  measurements: ApiElectricalMeasurements
  analytics: Record<string, unknown>
}

export interface ApiTelemetrySample {
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

export interface ApiEnergyInterval {
  start_time: string
  end_time: string
  start_kwh: number | null
  end_kwh: number | null
  energy_kwh: number | null
  status: 'OK' | 'GAP'
  reason?: string
}

export interface ApiEnergyResponse {
  origin_assurance: 'LABEL_ONLY'
  source_type: 'REAL'
  method: 'counter-delta'
  total_energy_kwh: number
  intervals: ApiEnergyInterval[]
  has_gaps: boolean
  demand: {
    availability: 'UNAVAILABLE' | 'AVAILABLE'
    reason_codes: string[]
    value: number | null
  }
  availability: 'UNAVAILABLE' | 'DEGRADED' | 'AVAILABLE'
  reason_codes?: string[]
  data_state: 'NO_DATA' | 'UNKNOWN'
}

export interface ApiLoadHistoryResponse {
  origin_assurance: 'LABEL_ONLY'
  source_type: 'REAL'
  load: {
    id: string
    site_id: string
    code: string
    name: string
  }
  count: number
  samples: ApiTelemetrySample[]
}

// --- System / Mapping Admin ---

export interface ApiMappingItem {
  id: string
  metric: string
  source_keys: string[]
  decode: 'number' | 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32'
  word_order: 'BE' | 'LE'
  byte_order: 'BE' | 'LE'
  scale: number
  offset: number
  unit: string
  verification_status: 'UNVERIFIED' | 'VERIFIED'
  verified_by: string | null
  verified_at: string | null
  evidence_note: string | null
  version: number
}

export interface ApiMeter {
  id: string
  label: string
  source_type: string
  slave_id: number | null
  model: string | null
  model_code: string | null
  modbus_variant_verified: boolean
  gateway: { id: string; code: string; mac: string } | null
  mappings: ApiMappingItem[]
}

export interface ApiSystemMappingResponse {
  meters: ApiMeter[]
}

export interface PutMappingItem {
  metric: string
  source_keys: string[]
  decode: ApiMappingItem['decode']
  word_order: 'BE' | 'LE'
  byte_order: 'BE' | 'LE'
  scale: number
  offset: number
  unit: string
  verification_status: 'UNVERIFIED' | 'VERIFIED'
  verified_by?: string | null
  verified_at?: string | null
  evidence_note?: string | null
}

export interface PutMappingBody {
  meter_id: string
  mappings: PutMappingItem[]
}

export interface ApiTestMappingItem {
  metric: string
  source_keys: string[]
  decode: ApiMappingItem['decode']
  word_order: 'BE' | 'LE'
  byte_order: 'BE' | 'LE'
  scale: number
  offset: number
  unit: string
  verification_status: 'UNVERIFIED' | 'VERIFIED'
}

export interface TestMappingBody {
  meter_id?: string
  gateway_mac?: string
  mapping: ApiTestMappingItem
  raw_payload?: Record<string, unknown>
}

export interface ApiTestMappingResponse {
  ok: boolean
  metric?: string
  raw_keys: Record<string, unknown>
  decoded_value: number | null
  unit?: string
  decode?: string
  word_order?: string
  byte_order?: string
  scale?: number
  offset?: number
  verification_status?: string
  local_server_ts?: number | null
  error?: string
  message?: string
}

export interface ApiGatewayMeterState {
  meter_id: string
  label: string
  slave_id: number | null
  state_assurance: 'gateway-level only'
  status: 'online' | 'unknown'
  note: string
}

export interface ApiSystemGatewayResponse {
  gateway: {
    id: string
    code: string
    name: string
    mac: string
    firmware_version: string | null
    rs485_master_verified: boolean
    status: 'connected' | 'polling' | 'disconnected' | 'disabled' | string
    mode: 'websocket' | 'poll' | 'none' | string
    last_receive_time: string | null
  }
  meters: ApiGatewayMeterState[]
}

export interface ApiBridgeMetrics {
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

export interface ApiBridgeStatusResponse {
  status: 'connected' | 'polling' | 'disconnected' | 'disabled' | string
  mode: 'websocket' | 'poll' | 'none' | string
  last_receive_time: string | null
  metrics: ApiBridgeMetrics
}

export class ApiError extends Error {
  statusCode: number
  code: string
  details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export class ApiClient {
  private baseUrl: string
  private csrfToken: string | null = null

  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL || '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  public setCsrfToken(token: string | null): void {
    this.csrfToken = token
  }

  public getCsrfToken(): string | null {
    return this.csrfToken
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
    const method = (options.method || 'GET').toUpperCase()

    const headers = new Headers(options.headers || {})
    headers.set('Accept', 'application/json')

    // State-changing requests require the CSRF token header
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      if (this.csrfToken) {
        headers.set('X-CSRF-Token', this.csrfToken)
      }
      if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
    }

    const response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: 'include', // Ensures HTTP-only cookie ems_session is sent
    })

    if (!response.ok) {
      let errorCode = 'UNKNOWN_ERROR'
      let errorMessage = `HTTP ${response.status} ${response.statusText}`
      let details: unknown = undefined

      try {
        const body = await response.json()
        if (body?.error) {
          errorCode = body.error.code || errorCode
          errorMessage = body.error.message || errorMessage
          details = body.error.details
        }
      } catch {
        // Non-JSON response
      }

      throw new ApiError(response.status, errorCode, errorMessage, details)
    }

    // Parse JSON. Note: JSON.parse leaves null as null.
    // We never coerce null to 0 anywhere in this client.
    return (await response.json()) as T
  }

  // --- Auth endpoints ---

  public async login(credentials: {
    username: string
    password: string
  }): Promise<AuthLoginResponse> {
    const data = await this.request<AuthLoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    this.setCsrfToken(data.csrfToken)
    return data
  }

  public async logout(): Promise<{ ok: boolean }> {
    try {
      const result = await this.request<{ ok: boolean }>('/api/auth/logout', {
        method: 'POST',
      })
      this.setCsrfToken(null)
      return result
    } catch (err) {
      this.setCsrfToken(null)
      throw err
    }
  }

  public async getMe(): Promise<AuthMeResponse> {
    const data = await this.request<AuthMeResponse>('/api/auth/me', {
      method: 'GET',
    })
    if (data.csrfToken) {
      this.setCsrfToken(data.csrfToken)
    }
    return data
  }

  public async changePassword(body: {
    currentPassword: string
    newPassword: string
  }): Promise<ChangePasswordResponse> {
    return this.request<ChangePasswordResponse>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  // --- Operational Read endpoints ---

  public async getOverview(sourceType: 'REAL' = 'REAL'): Promise<ApiOverviewResponse> {
    return this.request<ApiOverviewResponse>(`/api/overview?source_type=${sourceType}`)
  }

  public async getLoads(sourceType: 'REAL' = 'REAL'): Promise<ApiLoadsResponse> {
    return this.request<ApiLoadsResponse>(`/api/loads?source_type=${sourceType}`)
  }

  public async getLoadDetail(
    loadId: string,
    sourceType: 'REAL' = 'REAL',
  ): Promise<ApiLoadDetailResponse> {
    return this.request<ApiLoadDetailResponse>(
      `/api/loads/${encodeURIComponent(loadId)}?source_type=${sourceType}`,
    )
  }

  public async getLoadHistory(
    loadId: string,
    limit = 50,
    sourceType: 'REAL' = 'REAL',
  ): Promise<ApiLoadHistoryResponse> {
    return this.request<ApiLoadHistoryResponse>(
      `/api/loads/${encodeURIComponent(loadId)}/history?limit=${limit}&source_type=${sourceType}`,
    )
  }

  public async getEnergy(
    loadId?: string,
    siteId?: string,
    sourceType: 'REAL' = 'REAL',
  ): Promise<ApiEnergyResponse> {
    const params = new URLSearchParams()
    params.set('source_type', sourceType)
    if (loadId && loadId !== 'all') params.set('loadId', loadId)
    if (siteId) params.set('siteId', siteId)
    return this.request<ApiEnergyResponse>(`/api/energy?${params.toString()}`)
  }

  // --- System / Admin endpoints ---

  public async getSystemMapping(): Promise<ApiSystemMappingResponse> {
    return this.request<ApiSystemMappingResponse>('/api/system/mapping')
  }

  public async putSystemMapping(body: PutMappingBody): Promise<{ ok: boolean; meter_id: string; updatedCount: number }> {
    return this.request('/api/system/mapping', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  public async testSystemMapping(body: TestMappingBody): Promise<ApiTestMappingResponse> {
    return this.request<ApiTestMappingResponse>('/api/system/mapping/test', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  public async getSystemGateway(): Promise<ApiSystemGatewayResponse> {
    return this.request<ApiSystemGatewayResponse>('/api/system/gateway')
  }

  public async getBridgeStatus(): Promise<ApiBridgeStatusResponse> {
    return this.request<ApiBridgeStatusResponse>('/api/bridge/status')
  }
}

export const apiClient = new ApiClient()
