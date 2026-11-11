/**
 * DEMO alarms only. Thresholds are unconfirmed.
 * Acknowledgement mutates local UI state — not a real device clear.
 */

import type { AlarmItem } from '@/types'

export const DEMO_ALARMS_SEED: AlarmItem[] = [
  {
    id: 'alm-demo-001',
    severity: 'warning',
    status: 'active',
    type: 'overcurrent',
    title: 'High current — AC-03 (simulated threshold)',
    description:
      'Simulated overcurrent scenario for AC-03. Real trip limits are TBD and must not be inferred from this row.',
    loadId: 'AC-03',
    raisedAt: '2026-10-30T10:12:00+05:30',
    clearedAt: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    dataState: 'DEMO',
  },
  {
    id: 'alm-demo-002',
    severity: 'info',
    status: 'active',
    type: 'power_factor',
    title: 'PF below target — Compressor-01 (simulated)',
    description:
      'Simulated power-factor advisory. Target PF and delay are not confirmed.',
    loadId: 'Compressor-01',
    raisedAt: '2026-10-30T09:40:00+05:30',
    clearedAt: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    dataState: 'DEMO',
  },
  {
    id: 'alm-demo-003',
    severity: 'critical',
    status: 'acknowledged',
    type: 'communication',
    title: 'Communication gap (simulated scenario)',
    description:
      'Simulated gateway/meter communication gap. Does not reflect verified hardware status.',
    loadId: null,
    raisedAt: '2026-10-29T22:05:00+05:30',
    clearedAt: null,
    acknowledgedAt: '2026-10-29T22:20:00+05:30',
    acknowledgedBy: 'simulated.operator',
    dataState: 'DEMO',
  },
  {
    id: 'alm-demo-004',
    severity: 'warning',
    status: 'cleared',
    type: 'undervoltage',
    title: 'Undervoltage — AC-01 (simulated, cleared)',
    description: 'Historical simulated undervoltage event. Limits unconfirmed.',
    loadId: 'AC-01',
    raisedAt: '2026-10-28T14:05:00+05:30',
    clearedAt: '2026-10-28T14:40:00+05:30',
    acknowledgedAt: '2026-10-28T14:10:00+05:30',
    acknowledgedBy: 'simulated.operator',
    dataState: 'DEMO',
  },
  {
    id: 'alm-demo-005',
    severity: 'info',
    status: 'cleared',
    type: 'frequency',
    title: 'Frequency excursion — AC-02 (simulated, cleared)',
    description:
      'Historical simulated frequency note. Whether a frequency alarm is wanted is still VERIFY.',
    loadId: 'AC-02',
    raisedAt: '2026-10-27T08:15:00+05:30',
    clearedAt: '2026-10-27T08:22:00+05:30',
    acknowledgedAt: null,
    acknowledgedBy: null,
    dataState: 'DEMO',
  },
  {
    id: 'alm-demo-006',
    severity: 'critical',
    status: 'cleared',
    type: 'communication',
    title: 'Meter unreachable — AC-03 (simulated, cleared)',
    description: 'Historical simulated offline scenario. Not live gateway telemetry.',
    loadId: 'AC-03',
    raisedAt: '2026-10-25T19:00:00+05:30',
    clearedAt: '2026-10-25T20:10:00+05:30',
    acknowledgedAt: '2026-10-25T19:05:00+05:30',
    acknowledgedBy: 'simulated.admin',
    dataState: 'DEMO',
  },
]

export function createDemoAlarms(): AlarmItem[] {
  return DEMO_ALARMS_SEED.map((alarm) => ({ ...alarm }))
}
