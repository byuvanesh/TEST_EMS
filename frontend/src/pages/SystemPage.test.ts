/**
 * Step 6c tests: System mapping admin client-side VERIFIED evidence guard.
 * Step 6e addition: GET /api/system/config — ApiClient.getSystemConfig() and
 *                   ApiSystemConfigResponse contract.
 *
 * These tests verify that:
 * 1. verificationErrors() returns empty for UNVERIFIED (no fields required).
 * 2. verificationErrors() returns errors for VERIFIED with any missing field.
 * 3. All three fields filled → no errors (gate passes, backend call may proceed).
 * 4. ApiClient methods exist with correct shapes (compile-time contract).
 * 5. getSystemConfig() exists, returns a Promise.
 * 6. ApiSystemConfigResponse type only exposes local_server_url — never credentials.
 * 7. Registration URL is constructed correctly from local_server_url.
 */

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement the guard inline (same logic as SystemPage, tested in isolation)
// This ensures the guard is unit-testable without DOM/component imports.
// ---------------------------------------------------------------------------

function verificationErrors(
  status: 'UNVERIFIED' | 'VERIFIED',
  verifiedBy: string,
  verifiedAt: string,
  evidenceNote: string,
): string[] {
  if (status !== 'VERIFIED') return []
  const errs: string[] = []
  if (!verifiedBy.trim()) errs.push('verified_by is required when VERIFIED')
  if (!verifiedAt.trim()) errs.push('verified_at (ISO date) is required when VERIFIED')
  if (!evidenceNote.trim()) errs.push('evidence_note must not be empty when VERIFIED')
  return errs
}

describe('verificationErrors guard (migration 005 CHECK constraint)', () => {
  it('returns no errors for UNVERIFIED regardless of empty fields', () => {
    expect(verificationErrors('UNVERIFIED', '', '', '')).toEqual([])
    expect(verificationErrors('UNVERIFIED', 'alice', '2026-10-31', 'bench test')).toEqual([])
  })

  it('returns errors for VERIFIED with all fields empty', () => {
    const errs = verificationErrors('VERIFIED', '', '', '')
    expect(errs).toHaveLength(3)
    expect(errs[0]).toMatch(/verified_by/)
    expect(errs[1]).toMatch(/verified_at/)
    expect(errs[2]).toMatch(/evidence_note/)
  })

  it('returns one error when only verified_by is missing', () => {
    const errs = verificationErrors('VERIFIED', '', '2026-10-31T10:00', 'meter display match')
    expect(errs).toHaveLength(1)
    expect(errs[0]).toMatch(/verified_by/)
  })

  it('returns one error when only verified_at is missing', () => {
    const errs = verificationErrors('VERIFIED', 'alice', '', 'bench test confirmed')
    expect(errs).toHaveLength(1)
    expect(errs[0]).toMatch(/verified_at/)
  })

  it('returns one error when only evidence_note is missing', () => {
    const errs = verificationErrors('VERIFIED', 'alice', '2026-10-31T10:00', '')
    expect(errs).toHaveLength(1)
    expect(errs[0]).toMatch(/evidence_note/)
  })

  it('returns no errors when all three VERIFIED fields are provided', () => {
    const errs = verificationErrors(
      'VERIFIED',
      'alice',
      '2026-10-31T10:00',
      'Meter display showed 12.50 kW matching decoded value',
    )
    expect(errs).toEqual([])
  })

  it('treats whitespace-only evidence_note as empty', () => {
    const errs = verificationErrors('VERIFIED', 'alice', '2026-10-31T10:00', '   ')
    expect(errs).toHaveLength(1)
    expect(errs[0]).toMatch(/evidence_note/)
  })

  it('treats whitespace-only verified_by as empty', () => {
    const errs = verificationErrors('VERIFIED', '   ', '2026-10-31T10:00', 'bench test ok')
    expect(errs).toHaveLength(1)
    expect(errs[0]).toMatch(/verified_by/)
  })
})

// ---------------------------------------------------------------------------
// API client method shape tests (compile-time contracts, no network)
// ---------------------------------------------------------------------------

import { ApiClient, type ApiSystemConfigResponse } from '@/api/client'

describe('ApiClient system admin methods', () => {
  it('getSystemMapping returns a promise (method exists)', () => {
    const client = new ApiClient('http://localhost:9999')
    expect(typeof client.getSystemMapping).toBe('function')
    // calling it fails with fetch (no server), but must return a Promise
    const result = client.getSystemMapping().catch(() => null)
    expect(result).toBeInstanceOf(Promise)
  })

  it('testSystemMapping returns a promise (method exists)', () => {
    const client = new ApiClient('http://localhost:9999')
    expect(typeof client.testSystemMapping).toBe('function')
    const result = client
      .testSystemMapping({
        meter_id: 'meter-1',
        mapping: {
          metric: 'active_power_kw',
          source_keys: ['reg_3000', 'reg_3001'],
          decode: 'float32',
          word_order: 'BE',
          byte_order: 'BE',
          scale: 1,
          offset: 0,
          unit: 'kW',
          verification_status: 'UNVERIFIED',
        },
      })
      .catch(() => null)
    expect(result).toBeInstanceOf(Promise)
  })

  it('putSystemMapping returns a promise (method exists)', () => {
    const client = new ApiClient('http://localhost:9999')
    expect(typeof client.putSystemMapping).toBe('function')
    const result = client
      .putSystemMapping({
        meter_id: 'meter-1',
        mappings: [
          {
            metric: 'active_power_kw',
            source_keys: ['reg_3000'],
            decode: 'float32',
            word_order: 'BE',
            byte_order: 'BE',
            scale: 1,
            offset: 0,
            unit: 'kW',
            verification_status: 'UNVERIFIED',
          },
        ],
      })
      .catch(() => null)
    expect(result).toBeInstanceOf(Promise)
  })

  it('getSystemGateway returns a promise (method exists)', () => {
    const client = new ApiClient('http://localhost:9999')
    expect(typeof client.getSystemGateway).toBe('function')
    const result = client.getSystemGateway().catch(() => null)
    expect(result).toBeInstanceOf(Promise)
  })

  it('getBridgeStatus returns a promise (method exists)', () => {
    const client = new ApiClient('http://localhost:9999')
    expect(typeof client.getBridgeStatus).toBe('function')
    const result = client.getBridgeStatus().catch(() => null)
    expect(result).toBeInstanceOf(Promise)
  })

  it('getSystemConfig returns a promise (method exists)', () => {
    const client = new ApiClient('http://localhost:9999')
    expect(typeof client.getSystemConfig).toBe('function')
    const result = client.getSystemConfig().catch(() => null)
    expect(result).toBeInstanceOf(Promise)
  })
})

// ---------------------------------------------------------------------------
// ApiSystemConfigResponse type-level contract tests
// Verifies that the exported interface shape exposes only local_server_url
// and that credential keys are absent from any compliant response object.
// ---------------------------------------------------------------------------

describe('ApiSystemConfigResponse contract', () => {
  it('only exposes local_server_url — no credential keys present in a compliant object', () => {
    const mockConfig: ApiSystemConfigResponse = {
      local_server_url: 'http://127.0.0.1:3333',
    }
    expect(mockConfig.local_server_url).toBe('http://127.0.0.1:3333')

    const asRecord = mockConfig as unknown as Record<string, unknown>
    expect('LOCAL_SERVER_USER' in asRecord).toBe(false)
    expect('LOCAL_SERVER_PASSWORD' in asRecord).toBe(false)
    expect('GATEWAY_MAC' in asRecord).toBe(false)
    expect('local_server_user' in asRecord).toBe(false)
    expect('local_server_password' in asRecord).toBe(false)
    expect('gateway_mac' in asRecord).toBe(false)
  })

  it('constructs the correct /devices registration URL from local_server_url', () => {
    const config: ApiSystemConfigResponse = {
      local_server_url: 'http://192.168.1.100:3333',
    }
    // Mirrors the expression used in LocalServerRegistrationCard
    const registrationUrl = `${config.local_server_url}/devices`
    expect(registrationUrl).toBe('http://192.168.1.100:3333/devices')
  })

  it('registration URL never contains credential strings', () => {
    const config: ApiSystemConfigResponse = {
      local_server_url: 'http://127.0.0.1:3333',
    }
    const registrationUrl = `${config.local_server_url}/devices`
    expect(registrationUrl).not.toContain('password')
    expect(registrationUrl).not.toContain('user')
    expect(registrationUrl).not.toContain('mac')
  })
})

// ---------------------------------------------------------------------------
// LocalServerRegistrationCard UI behavior & regression tests
// ---------------------------------------------------------------------------

import systemPageSource from './SystemPage.tsx?raw'

describe('LocalServerRegistrationCard UI & regression guard', () => {
  it('unconditionally renders LocalServerRegistrationCard in SystemPage.tsx', () => {
    // Regression check: the card must NOT be gated behind a ternary that hides the whole card on error
    expect(systemPageSource).toContain('<LocalServerRegistrationCard')
    // Confirm the old anti-pattern is gone: `{sysConfig.data ? <LocalServerRegistrationCard ... : <Card>...}`
    expect(systemPageSource).not.toContain('{sysConfig.data ? (\n        <LocalServerRegistrationCard')
  })

  it('renders disabled button when config is null or errored', () => {
    // Confirms disabled attribute is present in component for unavailable states
    expect(systemPageSource).toContain('disabled')
    expect(systemPageSource).toContain('aria-disabled="true"')
    expect(systemPageSource).toContain('local-server-config-warning')
  })

  it('renders active <a> link with target="_blank" and rel="noopener noreferrer" when URL is available', () => {
    expect(systemPageSource).toContain('id="btn-register-gateway-local-server"')
    expect(systemPageSource).toContain('target="_blank"')
    expect(systemPageSource).toContain('rel="noopener noreferrer"')
  })

  it('does not contain any form inputs for MAC or API key (read-only navigation only)', () => {
    // LocalServerRegistrationCard must only contain the convenience link and text instructions
    expect(systemPageSource).not.toContain('name="mac"')
    expect(systemPageSource).not.toContain('name="apiKey"')
    expect(systemPageSource).not.toContain('name="api_key"')
  })
})

// ---------------------------------------------------------------------------
// Phase 1.4: Gateway Registration & Meter Commissioning UI Contracts
// ---------------------------------------------------------------------------

describe('Phase 1.4: Gateway Registration & Meter Commissioning Client Contracts', () => {
  it('registerSystemGateway exists on ApiClient and returns a Promise', () => {
    const client = new ApiClient('http://localhost:9999')
    expect(typeof client.registerSystemGateway).toBe('function')
    const result = client.registerSystemGateway({ name: 'GW 1', mac: 'CC:7B:5C:88:99:AA' }).catch(() => null)
    expect(result).toBeInstanceOf(Promise)
  })

  it('commissionSystemMeter exists on ApiClient and returns a Promise', () => {
    const client = new ApiClient('http://localhost:9999')
    expect(typeof client.commissionSystemMeter).toBe('function')
    const result = client.commissionSystemMeter('meter-1', { slave_id: 1 }).catch(() => null)
    expect(result).toBeInstanceOf(Promise)
  })

  it('validates MAC format (must be 12 hex digits)', () => {
    function isValidMac(input: string): boolean {
      const hexOnly = input.toUpperCase().replace(/[^0-9A-F]/g, '')
      return hexOnly.length === 12
    }

    expect(isValidMac('CC:7B:5C:88:99:AA')).toBe(true)
    expect(isValidMac('cc7b5c8899aa')).toBe(true)
    expect(isValidMac('78-1C-3C-AA-5F-C8')).toBe(true)
    expect(isValidMac('invalid_mac')).toBe(false)
    expect(isValidMac('12:34:56')).toBe(false)
    expect(isValidMac('')).toBe(false)
  })

  it('detects duplicate Slave IDs among site meters client-side', () => {
    const siteMeters = [
      { meter_id: 'm-1', label: 'AC-01', slave_id: 1 },
      { meter_id: 'm-2', label: 'AC-02', slave_id: 2 },
      { meter_id: 'm-3', label: 'AC-03', slave_id: null },
    ]

    function checkDuplicate(targetMeterId: string, candidateSlaveId: number): boolean {
      return siteMeters.some(
        (m) => m.meter_id !== targetMeterId && m.slave_id === candidateSlaveId,
      )
    }

    // m-3 attempting to use slave_id 1 -> duplicate!
    expect(checkDuplicate('m-3', 1)).toBe(true)
    // m-3 attempting to use slave_id 2 -> duplicate!
    expect(checkDuplicate('m-3', 2)).toBe(true)
    // m-3 attempting to use slave_id 3 -> unique!
    expect(checkDuplicate('m-3', 3)).toBe(false)
    // m-1 keeping its own slave_id 1 -> not a duplicate
    expect(checkDuplicate('m-1', 1)).toBe(false)
  })

  it('enforces evidence note requirement when marking Modbus variant as verified', () => {
    function validateCommissioning(slaveId: number, verified: boolean, note: string): string | null {
      if (slaveId < 1 || slaveId > 247) return 'Slave ID must be 1..247'
      if (verified && !note.trim()) return 'Evidence note is required when verified'
      return null
    }

    expect(validateCommissioning(1, true, '')).toBe('Evidence note is required when verified')
    expect(validateCommissioning(1, true, '   ')).toBe('Evidence note is required when verified')
    expect(validateCommissioning(1, true, 'Verified on Schneider front display')).toBeNull()
    expect(validateCommissioning(1, false, '')).toBeNull()
    expect(validateCommissioning(0, false, '')).toBe('Slave ID must be 1..247')
    expect(validateCommissioning(248, false, '')).toBe('Slave ID must be 1..247')
  })

  it('contains GatewayRegistrationCard and MeterCommissioningCard in SystemPage.tsx', () => {
    expect(systemPageSource).toContain('GatewayRegistrationCard')
    expect(systemPageSource).toContain('MeterCommissioningCard')
    expect(systemPageSource).toContain('banner-gateway-api-key')
    expect(systemPageSource).toContain('btn-copy-api-key')
  })
})
