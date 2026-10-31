/**
 * Decoder unit tests — Step 4 (Phase 2b)
 *
 * Test vectors:
 *  - Constructed IEEE 754 test vectors for float32 across all 4 word_order / byte_order combinations:
 *    Target float32 value: 230.5f (hex 0x43668000)
 *    Word 0: 0x4366 (17254), Word 1: 0x8000 (32768)
 *    BE/BE: reg0=17254, reg1=32768
 *    LE/BE: reg0=32768, reg1=17254 (Word Swap)
 *    BE/LE: reg0=26179, reg1=128   (Byte Swap)
 *    LE/LE: reg0=128,   reg1=26179 (Both Swapped)
 *  - uint16, int16 (including negative signed values)
 *  - uint32, int32 (including negative signed values)
 *  - "number" direct pass-through
 *  - Scale and offset arithmetic
 *  - Missing key producing NULL (never 0)
 *  - Null value producing NULL (never 0)
 *  - UNVERIFIED status producing NULL (even when decode would succeed)
 */

import { describe, expect, it } from 'vitest'
import { decodeMetric, type MetricMappingConfig } from '../../src/services/decoder.js'

describe('Step 4 — Metric Decoder (Phase 2b)', () => {
  // --------------------------------------------------------------------------
  // float32 across all 4 combinations (constructed test vectors for 230.5f)
  // --------------------------------------------------------------------------
  describe('float32 word and byte order combinations (constructed IEEE 754 vectors)', () => {
    it('DEC-01: float32 BE/BE (Standard Big-Endian ABCD) decodes 230.5 correctly', () => {
      const mapping: MetricMappingConfig = {
        metric: 'voltage_l1',
        source_keys: ['reg0', 'reg1'],
        decode: 'float32',
        word_order: 'BE',
        byte_order: 'BE',
        verification_status: 'VERIFIED',
      }
      // 0x4366 = 17254, 0x8000 = 32768
      const payload = { reg0: 17254, reg1: 32768 }
      const result = decodeMetric(mapping, payload)
      expect(result).toBe(230.5)
    })

    it('DEC-02: float32 LE/BE (Word Swap CDAB) decodes 230.5 correctly', () => {
      const mapping: MetricMappingConfig = {
        metric: 'voltage_l1',
        source_keys: ['reg0', 'reg1'],
        decode: 'float32',
        word_order: 'LE',
        byte_order: 'BE',
        verification_status: 'VERIFIED',
      }
      // Low word first: reg0=32768, reg1=17254
      const payload = { reg0: 32768, reg1: 17254 }
      const result = decodeMetric(mapping, payload)
      expect(result).toBe(230.5)
    })

    it('DEC-03: float32 BE/LE (Byte Swap BADC) decodes 230.5 correctly', () => {
      const mapping: MetricMappingConfig = {
        metric: 'voltage_l1',
        source_keys: ['reg0', 'reg1'],
        decode: 'float32',
        word_order: 'BE',
        byte_order: 'LE',
        verification_status: 'VERIFIED',
      }
      // 0x6643 = 26179, 0x0080 = 128
      const payload = { reg0: 26179, reg1: 128 }
      const result = decodeMetric(mapping, payload)
      expect(result).toBe(230.5)
    })

    it('DEC-04: float32 LE/LE (Both Swapped DCBA) decodes 230.5 correctly', () => {
      const mapping: MetricMappingConfig = {
        metric: 'voltage_l1',
        source_keys: ['reg0', 'reg1'],
        decode: 'float32',
        word_order: 'LE',
        byte_order: 'LE',
        verification_status: 'VERIFIED',
      }
      // Low word swapped: reg0=128, High word swapped: reg1=26179
      const payload = { reg0: 128, reg1: 26179 }
      const result = decodeMetric(mapping, payload)
      expect(result).toBe(230.5)
    })
  })

  // --------------------------------------------------------------------------
  // uint16 and int16
  // --------------------------------------------------------------------------
  describe('16-bit integer decodes', () => {
    it('DEC-05: uint16 decodes unsigned value correctly', () => {
      const mapping: MetricMappingConfig = {
        metric: 'power_kw',
        source_keys: ['reg0'],
        decode: 'uint16',
        scale: 0.1,
        offset: 0,
        verification_status: 'VERIFIED',
      }
      const payload = { reg0: 2305 }
      const result = decodeMetric(mapping, payload)
      expect(result).toBe(230.5)
    })

    it('DEC-06: int16 decodes signed negative value correctly', () => {
      const mapping: MetricMappingConfig = {
        metric: 'reactive_power',
        source_keys: ['reg0'],
        decode: 'int16',
        scale: 0.1,
        offset: 0,
        verification_status: 'VERIFIED',
      }
      // 65436 in two's complement is -100
      const payload = { reg0: 65436 }
      const result = decodeMetric(mapping, payload)
      expect(result).toBe(-10.0)
    })
  })

  // --------------------------------------------------------------------------
  // uint32 and int32
  // --------------------------------------------------------------------------
  describe('32-bit integer decodes', () => {
    it('DEC-07: uint32 decodes multi-word unsigned integer', () => {
      const mapping: MetricMappingConfig = {
        metric: 'energy_kwh',
        source_keys: ['reg0', 'reg1'],
        decode: 'uint32',
        word_order: 'BE',
        verification_status: 'VERIFIED',
      }
      // reg0=1, reg1=0 -> 1 * 65536 + 0 = 65536
      const payload = { reg0: 1, reg1: 0 }
      const result = decodeMetric(mapping, payload)
      expect(result).toBe(65536)
    })

    it('DEC-08: int32 decodes signed negative 32-bit integer', () => {
      const mapping: MetricMappingConfig = {
        metric: 'net_power',
        source_keys: ['reg0', 'reg1'],
        decode: 'int32',
        word_order: 'BE',
        verification_status: 'VERIFIED',
      }
      // 0xFFFF and 0xFF9C -> -100 in two's complement 32-bit
      const payload = { reg0: 0xffff, reg1: 0xff9c }
      const result = decodeMetric(mapping, payload)
      expect(result).toBe(-100)
    })
  })

  // --------------------------------------------------------------------------
  // "number" pass-through and scale/offset arithmetic
  // --------------------------------------------------------------------------
  describe('number pass-through and scale/offset', () => {
    it('DEC-09: number type passes through directly with scale and offset', () => {
      const mapping: MetricMappingConfig = {
        metric: 'frequency',
        source_keys: ['freq_raw'],
        decode: 'number',
        scale: 2.0,
        offset: 10.0,
        verification_status: 'VERIFIED',
      }
      const payload = { freq_raw: 20 }
      const result = decodeMetric(mapping, payload)
      expect(result).toBe(50.0) // 20 * 2.0 + 10.0
    })
  })

  // --------------------------------------------------------------------------
  // Missing key and null value tests (NEVER emit 0)
  // --------------------------------------------------------------------------
  describe('Missing and null source key safety', () => {
    it('DEC-10: Missing source key returns NULL, never 0', () => {
      const mapping: MetricMappingConfig = {
        metric: 'voltage_l1',
        source_keys: ['reg0', 'reg1'],
        decode: 'float32',
        verification_status: 'VERIFIED',
      }
      // reg1 is missing from payload
      const payload = { reg0: 17254 }
      const result = decodeMetric(mapping, payload)
      expect(result).toBeNull()
      expect(result).not.toBe(0)
    })

    it('DEC-11: Null value in source key returns NULL, never 0', () => {
      const mapping: MetricMappingConfig = {
        metric: 'voltage_l1',
        source_keys: ['reg0', 'reg1'],
        decode: 'float32',
        verification_status: 'VERIFIED',
      }
      // reg1 is explicitly null
      const payload = { reg0: 17254, reg1: null }
      const result = decodeMetric(mapping, payload)
      expect(result).toBeNull()
      expect(result).not.toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // Verification status enforcement
  // --------------------------------------------------------------------------
  describe('Verification status enforcement', () => {
    it('DEC-12: UNVERIFIED status always yields NULL even if decode math succeeds', () => {
      const mapping: MetricMappingConfig = {
        metric: 'voltage_l1',
        source_keys: ['reg0', 'reg1'],
        decode: 'float32',
        word_order: 'BE',
        byte_order: 'BE',
        verification_status: 'UNVERIFIED', // UNVERIFIED!
      }
      // Valid payload that would decode to 230.5
      const payload = { reg0: 17254, reg1: 32768 }

      // Standard decode: MUST be null
      const standardResult = decodeMetric(mapping, payload)
      expect(standardResult).toBeNull()

      // When ignoreVerificationStatus is explicitly true (test endpoint mode): returns 230.5
      const testResult = decodeMetric(mapping, payload, { ignoreVerificationStatus: true })
      expect(testResult).toBe(230.5)
    })
  })
})
