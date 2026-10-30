import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  rejectMixedSourceBatch,
  validateTelemetryV1,
} from '../../src/modules/telemetry/contract.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/telemetry',
)

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))
}

describe('telemetry contract v1 validator', () => {
  it('AT-09: valid payload passes', () => {
    const result = validateTelemetryV1(loadFixture('valid.json'))
    expect(result.ok).toBe(true)
  })

  it('accepts optional fields missing', () => {
    const result = validateTelemetryV1(loadFixture('optional-missing.json'))
    expect(result.ok).toBe(true)
  })

  it('AT-12: preserves explicit nulls as valid', () => {
    const result = validateTelemetryV1(loadFixture('explicit-nulls.json'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.samples[0]?.electrical.active_power_kw).toBeNull()
    }
  })

  it('AT-12: preserves zero as a valid reported value', () => {
    const result = validateTelemetryV1(loadFixture('zero-measurement.json'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.samples[0]?.electrical.active_power_kw).toBe(0)
    }
  })

  it('AT-10: invalid schema version fails', () => {
    const result = validateTelemetryV1(loadFixture('invalid-schema-version.json'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join(' ')).toMatch(/schema_version/i)
    }
  })

  it('rejects invalid numeric values', () => {
    const result = validateTelemetryV1(loadFixture('invalid-numeric.json'))
    expect(result.ok).toBe(false)
  })

  it('AT-11: mixed REAL/DEMO batch fails', () => {
    const result = rejectMixedSourceBatch(loadFixture('mixed-real-demo.json'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join(' ')).toMatch(/mixed|DEMO|REAL/i)
    }
  })

  it('allows unknown fields with warning (forward compatible)', () => {
    const result = validateTelemetryV1(loadFixture('unknown-fields.json'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.unknownEnvelopeKeys).toContain('future_extension')
    }
  })

  it('rejects duplicate sequence values in a batch', () => {
    const result = validateTelemetryV1(loadFixture('duplicate-sequence.json'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join(' ')).toMatch(/duplicate sequence/i)
    }
  })
})
