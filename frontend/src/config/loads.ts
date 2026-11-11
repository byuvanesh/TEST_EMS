import type { LoadDefinition, LoadId } from '@/types'

/**
 * Site load catalogue (confirmed names/colours/capacities).
 * Not telemetry — keep separate from SIMULATED series generators.
 */
export const LOAD_DEFINITIONS: LoadDefinition[] = [
  {
    id: 'AC-01',
    name: 'AC-01',
    capacityLabel: '5 TR',
    chartColor: '#3B82F6',
  },
  {
    id: 'AC-02',
    name: 'AC-02',
    capacityLabel: '5 TR',
    chartColor: '#0D9488',
  },
  {
    id: 'AC-03',
    name: 'AC-03',
    capacityLabel: '8 TR',
    chartColor: '#7C3AED',
  },
  {
    id: 'Compressor-01',
    name: 'Compressor-01',
    capacityLabel: 'Capacity TBD',
    chartColor: '#DB2777',
  },
]

export const ALL_LOAD_IDS: LoadId[] = LOAD_DEFINITIONS.map((l) => l.id)

export function getLoadDefinition(id: string): LoadDefinition | undefined {
  return LOAD_DEFINITIONS.find((load) => load.id === id)
}
