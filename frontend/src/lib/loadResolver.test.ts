import { describe, expect, it } from 'vitest'
import { resolveLoadIdentifier } from './loadResolver'
import type { ApiCatalogueLoad } from '@/api/client'

const MOCK_CATALOGUE: ApiCatalogueLoad[] = [
  {
    id: 'dec4b169-8da9-4dd5-be39-95dcf1eaa39c',
    site_id: 'site-1',
    code: 'AC-01',
    name: 'AC-01',
    capacity_label: '5 TR',
    chart_color: '#3B82F6',
    sort_order: 1,
    is_active: true,
  },
  {
    id: '39fd1f7f-a412-44b6-933d-b513868b523c',
    site_id: 'site-1',
    code: 'AC-02',
    name: 'AC-02',
    capacity_label: '5 TR',
    chart_color: '#0D9488',
    sort_order: 2,
    is_active: true,
  },
  {
    id: '97a93e9e-f74f-4105-aa56-bf7d5fd51115',
    site_id: 'site-1',
    code: 'AC-03',
    name: 'AC-03',
    capacity_label: '8 TR',
    chart_color: '#7C3AED',
    sort_order: 3,
    is_active: true,
  },
  {
    id: '8c2c9cf9-f9af-4710-be27-465423470208',
    site_id: 'site-1',
    code: 'Compressor-01',
    name: 'Compressor-01',
    capacity_label: 'Capacity TBD',
    chart_color: '#DB2777',
    sort_order: 4,
    is_active: true,
  },
]

describe('resolveLoadIdentifier', () => {
  it('resolves load code AC-01 to correct UUID', () => {
    const result = resolveLoadIdentifier('AC-01', MOCK_CATALOGUE)
    expect(result.isNotFound).toBe(false)
    expect(result.uuid).toBe('dec4b169-8da9-4dd5-be39-95dcf1eaa39c')
    expect(result.code).toBe('AC-01')
    expect(result.load?.name).toBe('AC-01')
  })

  it('resolves lowercase load code ac-01 case-insensitively', () => {
    const result = resolveLoadIdentifier('ac-01', MOCK_CATALOGUE)
    expect(result.isNotFound).toBe(false)
    expect(result.uuid).toBe('dec4b169-8da9-4dd5-be39-95dcf1eaa39c')
  })

  it('resolves AC-02, AC-03 and Compressor-01', () => {
    const resAc02 = resolveLoadIdentifier('AC-02', MOCK_CATALOGUE)
    expect(resAc02.uuid).toBe('39fd1f7f-a412-44b6-933d-b513868b523c')

    const resAc03 = resolveLoadIdentifier('AC-03', MOCK_CATALOGUE)
    expect(resAc03.uuid).toBe('97a93e9e-f74f-4105-aa56-bf7d5fd51115')

    const resComp = resolveLoadIdentifier('Compressor-01', MOCK_CATALOGUE)
    expect(resComp.uuid).toBe('8c2c9cf9-f9af-4710-be27-465423470208')
  })

  it('resolves when identifier is already a valid UUID in catalogue', () => {
    const result = resolveLoadIdentifier(
      'dec4b169-8da9-4dd5-be39-95dcf1eaa39c',
      MOCK_CATALOGUE,
    )
    expect(result.isNotFound).toBe(false)
    expect(result.uuid).toBe('dec4b169-8da9-4dd5-be39-95dcf1eaa39c')
    expect(result.code).toBe('AC-01')
  })

  it('allows uncatalogued valid UUID for direct backend lookup', () => {
    const customUuid = '11111111-2222-3333-4444-555555555555'
    const result = resolveLoadIdentifier(customUuid, MOCK_CATALOGUE)
    expect(result.isNotFound).toBe(false)
    expect(result.uuid).toBe(customUuid)
    expect(result.code).toBeNull()
  })

  it('returns isNotFound for unrecognized non-UUID load code', () => {
    const result = resolveLoadIdentifier('INVALID-LOAD', MOCK_CATALOGUE)
    expect(result.isNotFound).toBe(true)
    expect(result.uuid).toBeNull()
  })

  it('returns isNotFound for empty or undefined input', () => {
    expect(resolveLoadIdentifier('', MOCK_CATALOGUE).isNotFound).toBe(true)
    expect(resolveLoadIdentifier(undefined, MOCK_CATALOGUE).isNotFound).toBe(true)
    expect(resolveLoadIdentifier(null, MOCK_CATALOGUE).isNotFound).toBe(true)
  })
})
