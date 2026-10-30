import { Link } from 'react-router-dom'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfigLabel } from '@/components/ui/ConfigLabel'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  ALARM_THRESHOLD_FIELDS,
  COMMUNICATION_FIELDS,
  GATEWAY_FIELDS,
  METER_ASSIGNMENT_ROWS,
  RETENTION_FIELDS,
  SERIAL_PROPOSAL_FIELDS,
  USER_ROLE_FIELDS,
} from '@/mock/systemDemoConfig'
import { LOAD_DEFINITIONS } from '@/config/loads'
import type { ConfigField } from '@/types'

export function SystemPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="System"
        description="Configuration overview. Confirmed load names only — all device settings labelled by certainty."
        actions={<StatusBadge state="DEMO" />}
      />

      <DataStateBanner
        state="DEMO"
        message="No gateway, Modbus map, CT ratios, or live communication metrics are claimed. Fields marked PROPOSED / TBD / NOT CONFIGURED / VERIFY are not site facts."
      />

      <Card padding="none">
        <div className="border-b border-border px-5 py-4">
          <CardHeader
            className="mb-0"
            title="Loads and meter assignments"
            subtitle="Load names/capacities CONFIRMED · meter/slave/CT NOT CONFIGURED"
            action={<StatusBadge state="DEMO" compact />}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-surface text-xs text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Load</th>
                <th className="px-4 py-3 font-medium">Capacity</th>
                <th className="px-4 py-3 font-medium">Meter</th>
                <th className="px-4 py-3 font-medium">Slave ID</th>
                <th className="px-4 py-3 font-medium">CT ratio</th>
                <th className="px-4 py-3 font-medium">Register map</th>
              </tr>
            </thead>
            <tbody>
              {METER_ASSIGNMENT_ROWS.map((row) => {
                const def = LOAD_DEFINITIONS.find((l) => l.id === row.loadId)
                return (
                  <tr key={row.loadId} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link
                        to={`/loads/${row.loadId}`}
                        className="inline-flex items-center gap-2 font-medium text-accent hover:underline"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: def?.chartColor }}
                        />
                        {row.loadId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.capacityLabel}
                    </td>
                    <td className="px-4 py-3">
                      <ConfigLabel certainty="NOT_CONFIGURED" />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {row.slaveId}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {row.ctRatio}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {row.registerMap}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-[11px] text-text-secondary">
          Intentionally omitted: Modbus register addresses, confirmed slave IDs,
          CT primaries, and success-rate inventing.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ConfigSection
          title="Gateway status"
          subtitle="Hardware capability unverified"
          fields={GATEWAY_FIELDS}
        />
        <ConfigSection
          title="Communication overview"
          subtitle="Not live Modbus statistics"
          fields={COMMUNICATION_FIELDS}
        />
        <ConfigSection
          title="Serial configuration"
          subtitle="Read-only proposal — not commissioned settings"
          fields={SERIAL_PROPOSAL_FIELDS}
        />
        <ConfigSection
          title="Alarm thresholds"
          subtitle="Unconfirmed — do not treat as setpoints"
          fields={ALARM_THRESHOLD_FIELDS}
        />
        <ConfigSection
          title="Data retention"
          subtitle="Unconfirmed"
          fields={RETENTION_FIELDS}
        />
        <ConfigSection
          title="Users and roles"
          subtitle="Proposal only — auth not implemented"
          fields={USER_ROLE_FIELDS}
        />
      </div>
    </div>
  )
}

function ConfigSection({
  title,
  subtitle,
  fields,
}: {
  title: string
  subtitle: string
  fields: ConfigField[]
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={<StatusBadge state="DEMO" compact />}
      />
      <ul className="divide-y divide-border rounded-[8px] border border-border">
        {fields.map((field) => (
          <li
            key={field.label}
            className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">{field.label}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{field.value}</p>
              {field.note ? (
                <p className="mt-1 text-[11px] text-text-secondary">{field.note}</p>
              ) : null}
            </div>
            <ConfigLabel certainty={field.certainty} className="shrink-0" />
          </li>
        ))}
      </ul>
    </Card>
  )
}
