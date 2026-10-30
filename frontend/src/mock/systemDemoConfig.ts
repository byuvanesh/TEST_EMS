/**
 * System configuration display model.
 * Only confirmed load names/capacities are factual; everything else is labelled.
 */

import { LOAD_DEFINITIONS } from '@/config/loads'
import type { ConfigField, LoadId } from '@/types'

export interface MeterAssignmentRow {
  loadId: LoadId
  capacityLabel: string
  meterLabel: string
  slaveId: string
  ctRatio: string
  registerMap: string
  certaintyNote: string
}

export const METER_ASSIGNMENT_ROWS: MeterAssignmentRow[] = LOAD_DEFINITIONS.map(
  (load) => ({
    loadId: load.id,
    capacityLabel: load.capacityLabel,
    meterLabel: 'NOT CONFIGURED',
    slaveId: 'TBD — not assigned',
    ctRatio: 'TBD — not measured / not entered',
    registerMap: 'TBD — official map unavailable',
    certaintyNote: 'Do not invent Modbus addresses, CT ratios, or slave IDs.',
  }),
)

export const GATEWAY_FIELDS: ConfigField[] = [
  {
    label: 'Gateway identity',
    value: 'NOT CONFIGURED',
    certainty: 'NOT_CONFIGURED',
    note: 'Product / firmware ownership open (VERIFY).',
  },
  {
    label: 'Link state',
    value: 'unknown',
    certainty: 'NOT_CONFIGURED',
    note: 'No live connectivity claimed.',
  },
  {
    label: 'Last heard',
    value: '—',
    certainty: 'NOT_CONFIGURED',
  },
  {
    label: 'RS-485 Modbus RTU master',
    value: 'VERIFY',
    certainty: 'VERIFY',
    note: 'Capability unproven on target hardware.',
  },
]

export const COMMUNICATION_FIELDS: ConfigField[] = [
  {
    label: 'Meters reporting',
    value: '0 / 4',
    certainty: 'NOT_CONFIGURED',
    note: 'DEMO placeholder — not a Modbus success rate.',
  },
  {
    label: 'Poll interval',
    value: '2 s (PROPOSED)',
    certainty: 'PROPOSED',
  },
  {
    label: 'Store-and-forward',
    value: 'TBD',
    certainty: 'TBD',
  },
  {
    label: 'Ingest protocol',
    value: 'TBD (REST or MQTT)',
    certainty: 'TBD',
  },
]

export const SERIAL_PROPOSAL_FIELDS: ConfigField[] = [
  {
    label: 'Baud rate',
    value: '9600',
    certainty: 'PROPOSED',
    note: 'Datasheet default; not confirmed for this site.',
  },
  {
    label: 'Parity',
    value: 'None',
    certainty: 'PROPOSED',
  },
  {
    label: 'Stop bits',
    value: '1',
    certainty: 'PROPOSED',
  },
  {
    label: 'Data bits',
    value: '8 (typical Modbus RTU)',
    certainty: 'VERIFY',
    note: 'Datasheet silent — VERIFY.',
  },
  {
    label: 'Topology',
    value: 'Daisy chain, termination at ends',
    certainty: 'PROPOSED',
  },
]

export const ALARM_THRESHOLD_FIELDS: ConfigField[] = [
  {
    label: 'Overcurrent limits',
    value: 'NOT CONFIGURED',
    certainty: 'TBD',
    note: 'Requires nameplate / CT sizing.',
  },
  {
    label: 'Undervoltage / overvoltage',
    value: 'NOT CONFIGURED',
    certainty: 'TBD',
  },
  {
    label: 'PF target',
    value: 'NOT CONFIGURED',
    certainty: 'TBD',
  },
  {
    label: 'Frequency alarm',
    value: 'VERIFY whether wanted',
    certainty: 'VERIFY',
  },
]

export const RETENTION_FIELDS: ConfigField[] = [
  {
    label: 'Raw sample retention',
    value: 'TBD',
    certainty: 'TBD',
  },
  {
    label: 'Rollup retention',
    value: 'TBD',
    certainty: 'TBD',
  },
  {
    label: 'Backup RPO / RTO',
    value: 'TBD',
    certainty: 'TBD',
  },
]

export const USER_ROLE_FIELDS: ConfigField[] = [
  {
    label: 'Viewer',
    value: 'Read dashboards & alarms',
    certainty: 'PROPOSED',
  },
  {
    label: 'Operator',
    value: 'Acknowledge alarms (proposed)',
    certainty: 'PROPOSED',
  },
  {
    label: 'Admin',
    value: 'System configuration (proposed)',
    certainty: 'PROPOSED',
    note: 'Per-action matrix not defined. Auth not implemented in Phase 1.',
  },
]
