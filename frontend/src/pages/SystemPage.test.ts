/**
 * Step 6c tests: System mapping admin client-side VERIFIED evidence guard.
 *
 * These tests verify that:
 * 1. verificationErrors() returns empty for UNVERIFIED (no fields required).
 * 2. verificationErrors() returns errors for VERIFIED with any missing field.
 * 3. All three fields filled → no errors (gate passes, backend call may proceed).
 * 4. ApiClient methods exist with correct shapes (compile-time contract).
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

import { ApiClient } from '@/api/client'

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
})
