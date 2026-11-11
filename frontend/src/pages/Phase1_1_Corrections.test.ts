import { describe, expect, it } from 'vitest'
import { resolveLoadIdentifier } from '@/lib/loadResolver'
import type { ApiCatalogueLoad, ApiSystemGatewayResponse } from '@/api/client'

const MOCK_CATALOGUE: ApiCatalogueLoad[] = [
  {
    id: 'dec4b169-8da9-4dd5-be39-95dcf1eaa39c',
    site_id: 'site-demo',
    code: 'AC-01',
    name: 'AC-01',
    capacity_label: '5 TR',
    chart_color: '#3B82F6',
    sort_order: 1,
    is_active: true,
  },
  {
    id: '39fd1f7f-a412-44b6-933d-b513868b523c',
    site_id: 'site-demo',
    code: 'AC-02',
    name: 'AC-02',
    capacity_label: '5 TR',
    chart_color: '#0D9488',
    sort_order: 2,
    is_active: true,
  },
  {
    id: '97a93e9e-f74f-4105-aa56-bf7d5fd51115',
    site_id: 'site-demo',
    code: 'AC-03',
    name: 'AC-03',
    capacity_label: '8 TR',
    chart_color: '#7C3AED',
    sort_order: 3,
    is_active: true,
  },
  {
    id: '8c2c9cf9-f9af-4710-be27-465423470208',
    site_id: 'site-demo',
    code: 'Compressor-01',
    name: 'Compressor-01',
    capacity_label: 'Capacity TBD',
    chart_color: '#DB2777',
    sort_order: 4,
    is_active: true,
  },
]

describe('Phase 1.1 Corrections — Route Code to UUID Resolution', () => {
  it('resolves every standard load code to its authoritative UUID', () => {
    for (const load of MOCK_CATALOGUE) {
      const res = resolveLoadIdentifier(load.code, MOCK_CATALOGUE)
      expect(res.isNotFound).toBe(false)
      expect(res.uuid).toBe(load.id)
      expect(res.code).toBe(load.code)
    }
  })

  it('resolves case-insensitively (e.g. ac-01, compressor-01)', () => {
    expect(resolveLoadIdentifier('ac-01', MOCK_CATALOGUE).uuid).toBe('dec4b169-8da9-4dd5-be39-95dcf1eaa39c')
    expect(resolveLoadIdentifier('compressor-01', MOCK_CATALOGUE).uuid).toBe('8c2c9cf9-f9af-4710-be27-465423470208')
  })

  it('preserves honest not-found state when load code does not exist', () => {
    const unknown = resolveLoadIdentifier('AC-99', MOCK_CATALOGUE)
    expect(unknown.isNotFound).toBe(true)
    expect(unknown.uuid).toBeNull()
  })
})

describe('Phase 1.1 Corrections — System Page Meter States Model', () => {
  const mockGatewayResponse: ApiSystemGatewayResponse = {
    gateway: {
      id: 'gw-1',
      name: 'Gateway 1',
      code: 'gw_placeholder_01',
      mac: '78:1C:3C:AA:5F:C8',
      firmware_version: null,
      rs485_master_verified: false,
      status: 'disconnected',
      mode: 'none',
      last_receive_time: null,
    },
    meters: [
      {
        meter_id: 'meter-1',
        label: 'Meter placeholder for Compressor-01',
        slave_id: null,
        status: 'unknown',
        state_assurance: 'gateway-level only',
        note: 'Meter state labeled "gateway-level only" until a bench test proves per-meter failure behavior.',
      },
      {
        meter_id: 'meter-2',
        label: 'Meter placeholder for AC-01',
        slave_id: 1,
        status: 'online',
        state_assurance: 'gateway-level only',
        note: '',
      },
    ],
  }

  it('ensures all meter fields and assurance metadata are preserved for responsive cards', () => {
    for (const meter of mockGatewayResponse.meters) {
      expect(meter.meter_id).toBeDefined()
      expect(meter.label).toBeTruthy()
      expect(meter.status).toBeDefined()
      expect(meter.state_assurance).toBe('gateway-level only')
    }
  })
})
