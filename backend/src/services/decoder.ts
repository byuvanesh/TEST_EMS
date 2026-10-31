/**
 * Metric Decoder — Step 4 (Phase 2b)
 *
 * Decodes raw Modbus registers into physical metric engineering units.
 *
 * Supported decode types:
 *  - 'number': Direct numeric pass-through (applies scale and offset)
 *  - 'uint16': 16-bit unsigned integer (0..65535)
 *  - 'int16': 16-bit signed integer (-32768..32767)
 *  - 'uint32': 32-bit unsigned integer (2 x 16-bit words)
 *  - 'int32': 32-bit signed integer (2 x 16-bit words)
 *  - 'float32': IEEE 754 32-bit single-precision floating point
 *
 * Word and Byte ordering:
 *  - word_order: 'BE' (Big Endian words, ABCD/BADC) | 'LE' (Word Swap, CDAB/DCBA)
 *  - byte_order: 'BE' (Big Endian bytes) | 'LE' (Byte Swap)
 *
 * Safety rules:
 *  - Missing or null source keys ALWAYS return null, NEVER 0.
 *  - UNVERIFIED mappings ALWAYS return null in production telemetry,
 *    regardless of decode success (overrideable only via ignoreVerificationStatus in test endpoint).
 *  - Scale and offset: result = rawValue * scale + offset
 */

export type DecodeType = 'number' | 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32'
export type WordOrder = 'BE' | 'LE'
export type ByteOrder = 'BE' | 'LE'
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED'

export interface MetricMappingConfig {
  id?: string
  meter_id?: string
  metric: string
  source_keys: string[]
  decode: DecodeType
  word_order?: WordOrder
  byte_order?: ByteOrder
  scale?: number | string
  offset?: number | string
  unit?: string
  verification_status?: VerificationStatus
  verified_by?: string | null
  verified_at?: string | Date | null
  evidence_note?: string | null
  version?: number
}

export interface DecodeOptions {
  /**
   * If true, returns the decoded numerical value even if verification_status is UNVERIFIED.
   * Used strictly by the mapping test endpoint (/api/system/mapping/test) to compare raw registers
   * against the physical meter display before committing to a VERIFIED status.
   * Defaults to false.
   */
  ignoreVerificationStatus?: boolean
}

/**
 * Decode a metric mapping against a raw payload dictionary.
 * Returns the decoded number (with scale and offset applied), or null if the mapping is
 * unverified, missing keys, or contains invalid data.
 */
export function decodeMetric(
  mapping: MetricMappingConfig,
  rawPayload: Record<string, unknown> | null | undefined,
  options: DecodeOptions = {},
): number | null {
  // 1. Unverified protection: UNVERIFIED mappings always return null unless explicitly ignored in test mode
  if (!options.ignoreVerificationStatus && mapping.verification_status !== 'VERIFIED') {
    return null
  }

  if (!rawPayload || typeof rawPayload !== 'object') {
    return null
  }

  const { source_keys, decode } = mapping
  if (!Array.isArray(source_keys) || source_keys.length === 0) {
    return null
  }

  // 2. Validate that all required source keys exist and are not null/undefined
  for (const key of source_keys) {
    if (!(key in rawPayload)) return null
    const val = rawPayload[key]
    if (val === null || val === undefined) return null
    if (typeof val !== 'number' && typeof val !== 'string') return null
    if (typeof val === 'string' && val.trim() === '') return null
  }

  const scale = mapping.scale != null && !isNaN(Number(mapping.scale)) ? Number(mapping.scale) : 1
  const offset = mapping.offset != null && !isNaN(Number(mapping.offset)) ? Number(mapping.offset) : 0
  const wordOrder = mapping.word_order ?? 'BE'
  const byteOrder = mapping.byte_order ?? 'BE'

  // 3. Decode by type
  switch (decode) {
    case 'number': {
      const rawVal = Number(rawPayload[source_keys[0]!])
      if (isNaN(rawVal) || !isFinite(rawVal)) return null
      return applyScaleAndOffset(rawVal, scale, offset)
    }

    case 'uint16': {
      const rawVal = Number(rawPayload[source_keys[0]!])
      if (isNaN(rawVal) || !isFinite(rawVal)) return null
      let word = Math.trunc(rawVal) & 0xffff
      if (byteOrder === 'LE') {
        word = ((word & 0xff) << 8) | ((word >> 8) & 0xff)
      }
      return applyScaleAndOffset(word, scale, offset)
    }

    case 'int16': {
      const rawVal = Number(rawPayload[source_keys[0]!])
      if (isNaN(rawVal) || !isFinite(rawVal)) return null
      let word = Math.trunc(rawVal) & 0xffff
      if (byteOrder === 'LE') {
        word = ((word & 0xff) << 8) | ((word >> 8) & 0xff)
      }
      // Two's complement 16-bit signed
      const signedVal = (word << 16) >> 16
      return applyScaleAndOffset(signedVal, scale, offset)
    }

    case 'uint32':
    case 'int32':
    case 'float32': {
      let w0: number
      let w1: number

      if (source_keys.length >= 2) {
        const val0 = Number(rawPayload[source_keys[0]!])
        const val1 = Number(rawPayload[source_keys[1]!])
        if (isNaN(val0) || isNaN(val1) || !isFinite(val0) || !isFinite(val1)) return null
        w0 = Math.trunc(val0) & 0xffff
        w1 = Math.trunc(val1) & 0xffff
      } else {
        const val = Number(rawPayload[source_keys[0]!])
        if (isNaN(val) || !isFinite(val)) return null
        const intVal = Math.trunc(val) >>> 0
        w0 = (intVal >>> 16) & 0xffff
        w1 = intVal & 0xffff
      }

      // Extract bytes for word 0 with byte-order adjustment
      const b0 = (w0 >> 8) & 0xff
      const b1 = w0 & 0xff
      const [w0_b0, w0_b1] = byteOrder === 'LE' ? [b1, b0] : [b0, b1]

      // Extract bytes for word 1 with byte-order adjustment
      const b2 = (w1 >> 8) & 0xff
      const b3 = w1 & 0xff
      const [w1_b0, w1_b1] = byteOrder === 'LE' ? [b3, b2] : [b2, b3]

      // Assemble 4 bytes according to word_order
      const bytes =
        wordOrder === 'BE'
          ? [w0_b0, w0_b1, w1_b0, w1_b1]
          : [w1_b0, w1_b1, w0_b0, w0_b1]

      const buf = Buffer.from(bytes)

      if (decode === 'uint32') {
        const uintVal = buf.readUInt32BE(0)
        return applyScaleAndOffset(uintVal, scale, offset)
      }

      if (decode === 'int32') {
        const intVal = buf.readInt32BE(0)
        return applyScaleAndOffset(intVal, scale, offset)
      }

      if (decode === 'float32') {
        const floatVal = buf.readFloatBE(0)
        if (isNaN(floatVal) || !isFinite(floatVal)) return null
        return applyScaleAndOffset(floatVal, scale, offset, 6)
      }

      return null
    }

    default:
      return null
  }
}

function applyScaleAndOffset(
  rawVal: number,
  scale: number,
  offset: number,
  precision = 6,
): number {
  const result = rawVal * scale + offset
  const factor = Math.pow(10, precision)
  return Math.round(result * factor) / factor
}
