import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError } from './client'

describe('ApiClient', () => {
  let client: ApiClient
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    client = new ApiClient('http://localhost:3001')
  })

  it('includes credentials: "include" on every request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    })

    await client.request('/api/health')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/health',
      expect.objectContaining({
        credentials: 'include',
      }),
    )
  })

  it('stores CSRF token in memory only and attaches X-CSRF-Token on subsequent POST requests', async () => {
    // 1. Mock login response returning csrfToken
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: 'usr-1', username: 'admin', role: 'admin', mustChangePassword: false },
        csrfToken: 'test-csrf-token-12345',
      }),
    })

    const loginRes = await client.login({ username: 'admin', password: 'password123' })
    expect(loginRes.csrfToken).toBe('test-csrf-token-12345')
    expect(client.getCsrfToken()).toBe('test-csrf-token-12345')

    // 2. Subsequent state-changing request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, mustChangePassword: false }),
    })

    await client.changePassword({ currentPassword: 'old', newPassword: 'newpassword123' })

    const lastCall = mockFetch.mock.calls[1]
    const headers = lastCall[1].headers as Headers
    expect(headers.get('X-CSRF-Token')).toBe('test-csrf-token-12345')
  })

  it('clears in-memory CSRF token on logout', async () => {
    client.setCsrfToken('existing-csrf-token')
    expect(client.getCsrfToken()).toBe('existing-csrf-token')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    })

    await client.logout()
    expect(client.getCsrfToken()).toBeNull()
  })

  it('throws ApiError with server details on error responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      }),
    })

    await expect(client.login({ username: 'admin', password: 'bad' })).rejects.toThrow(ApiError)

    try {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password',
          },
        }),
      })
      await client.login({ username: 'admin', password: 'bad' })
    } catch (err) {
      const apiErr = err as ApiError
      expect(apiErr.statusCode).toBe(401)
      expect(apiErr.code).toBe('INVALID_CREDENTIALS')
      expect(apiErr.message).toBe('Invalid username or password')
    }
  })

  it('never coerces null to 0 in response telemetry', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        origin_assurance: 'LABEL_ONLY',
        source_type: 'REAL',
        data_state: 'NO_DATA',
        as_of: null,
        load: {
          id: 'ld-1',
          site_id: 'site-1',
          code: 'AC-01',
          name: 'Air Conditioner 1',
          capacity_label: '11 kW',
          chart_color: '#3B82F6',
        },
        measurements: {
          active_power_kw: null,
          current_a: null,
          voltage_v: null,
          power_factor: null,
          frequency_hz: null,
          reactive_power_kvar: null,
          apparent_power_kva: null,
          active_import_kwh: null,
        },
        analytics: {},
      }),
    })

    const detail = await client.getLoadDetail('AC-01')
    expect(detail.as_of).toBeNull()
    expect(detail.measurements.active_power_kw).toBeNull()
    expect(detail.measurements.active_power_kw).not.toBe(0)
    expect(detail.measurements.current_a).toBeNull()
    expect(detail.measurements.voltage_v).toBeNull()
    expect(detail.measurements.power_factor).toBeNull()
    expect(detail.measurements.frequency_hz).toBeNull()
  })
})
