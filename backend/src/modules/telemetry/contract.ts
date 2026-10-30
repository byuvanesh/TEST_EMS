/**
 * testems.telemetry.v1 validator — library/test artifact only.
 * No production ingest HTTP route in Phase 2a.
 *
 * Source of truth: docs/telemetry-contract-v1.md
 */
import { z } from 'zod'

export const TELEMETRY_SCHEMA_VERSION = 'testems.telemetry.v1' as const

const finiteNumber = z.number().finite()
const nullableFinite = finiteNumber.nullable()

const ElectricalSchema = z
  .object({
    active_power_kw: nullableFinite.optional(),
    current_a: nullableFinite.optional(),
    voltage_v: nullableFinite.optional(),
    power_factor: nullableFinite.optional(),
    frequency_hz: nullableFinite.optional(),
    reactive_power_kvar: nullableFinite.optional(),
    apparent_power_kva: nullableFinite.optional(),
    voltage_l1_v: nullableFinite.optional(),
    voltage_l2_v: nullableFinite.optional(),
    voltage_l3_v: nullableFinite.optional(),
    current_l1_a: nullableFinite.optional(),
    current_l2_a: nullableFinite.optional(),
    current_l3_a: nullableFinite.optional(),
  })
  .passthrough()

const EnergySchema = z
  .object({
    active_import_kwh: finiteNumber.nonnegative().nullable().optional(),
    active_import_raw: finiteNumber.nullable().optional(),
    counter_unit: z.string().optional(),
  })
  .passthrough()

const CapabilitiesSchema = z
  .object({
    reports_energy_import: z.boolean().optional(),
    reports_per_phase: z.boolean().optional(),
    reports_reactive: z.boolean().optional(),
    reports_thd: z.boolean().optional(),
  })
  .passthrough()

const SampleSchema = z
  .object({
    meter_id: z.string().min(1),
    load_id: z.string().min(1),
    load_code: z.string().min(1).optional(),
    timestamp: z.string().datetime({ offset: true }),
    sequence: z.number().int().nonnegative(),
    quality: z.enum(['LIVE', 'STALE', 'OFFLINE', 'UNKNOWN']),
    electrical: ElectricalSchema,
    energy: EnergySchema.optional(),
    capabilities: CapabilitiesSchema.optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

const EnvelopeSchema = z
  .object({
    schema_version: z.string().min(1),
    source_type: z.enum(['REAL', 'DEMO']),
    gateway_id: z.string().min(1),
    sent_at: z.string().datetime({ offset: true }),
    samples: z.array(SampleSchema).min(1),
  })
  .passthrough()

export type TelemetryEnvelope = z.infer<typeof EnvelopeSchema>

export interface TelemetryValidationSuccess {
  ok: true
  data: TelemetryEnvelope
  unknownEnvelopeKeys: string[]
  warnings: string[]
}

export interface TelemetryValidationFailure {
  ok: false
  errors: string[]
}

export type TelemetryValidationResult =
  | TelemetryValidationSuccess
  | TelemetryValidationFailure

const KNOWN_ENVELOPE_KEYS = new Set([
  'schema_version',
  'source_type',
  'gateway_id',
  'sent_at',
  'samples',
])

export function validateTelemetryV1(input: unknown): TelemetryValidationResult {
  const parsed = EnvelopeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
      ),
    }
  }

  const data = parsed.data
  const errors: string[] = []
  const warnings: string[] = []

  if (data.schema_version !== TELEMETRY_SCHEMA_VERSION) {
    errors.push(
      `schema_version: unsupported '${data.schema_version}' (expected '${TELEMETRY_SCHEMA_VERSION}')`,
    )
  }

  // Contract: reject mixed REAL/DEMO in one envelope — samples inherit envelope source_type.
  // If a sample illegally carries source_type, reject.
  for (const [idx, sample] of data.samples.entries()) {
    const extra = sample as Record<string, unknown>
    if ('source_type' in extra && extra.source_type !== data.source_type) {
      errors.push(
        `samples[${idx}].source_type: mixed REAL/DEMO in one envelope is not allowed`,
      )
    }
  }

  // Duplicate sequences within batch
  const seen = new Set<string>()
  for (const [idx, sample] of data.samples.entries()) {
    const key = `${sample.meter_id}:${sample.sequence}`
    if (seen.has(key)) {
      errors.push(
        `samples[${idx}].sequence: duplicate sequence ${sample.sequence} for meter ${sample.meter_id} in batch`,
      )
    }
    seen.add(key)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const unknownEnvelopeKeys = Object.keys(data).filter((k) => !KNOWN_ENVELOPE_KEYS.has(k))
  if (unknownEnvelopeKeys.length > 0) {
    // Contract PROPOSED: ignore unknown keys (forward compatible)
    warnings.push(`Ignored unknown envelope keys: ${unknownEnvelopeKeys.join(', ')}`)
  }

  return {
    ok: true,
    data,
    unknownEnvelopeKeys,
    warnings,
  }
}

/**
 * Detect mixed source types if caller mistakenly builds a multi-source batch object.
 * Standard envelope has a single source_type; this helper supports fixture testing.
 */
export function rejectMixedSourceBatch(raw: unknown): TelemetryValidationResult {
  if (!raw || typeof raw !== 'object') {
    return validateTelemetryV1(raw)
  }
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.samples)) {
    for (const sample of obj.samples) {
      if (
        sample &&
        typeof sample === 'object' &&
        'source_type' in sample &&
        obj.source_type !== undefined &&
        (sample as { source_type?: unknown }).source_type !== obj.source_type
      ) {
        return {
          ok: false,
          errors: ['samples: mixed REAL/DEMO batches are rejected'],
        }
      }
    }
  }
  // Explicit multi-envelope abuse fixture: { batches: [...] }
  if (Array.isArray(obj.batches)) {
    const types = new Set(
      obj.batches
        .map((b) =>
          b && typeof b === 'object'
            ? (b as { source_type?: unknown }).source_type
            : undefined,
        )
        .filter(Boolean),
    )
    if (types.size > 1) {
      return { ok: false, errors: ['batches: mixed REAL/DEMO batches are rejected'] }
    }
  }
  return validateTelemetryV1(raw)
}
