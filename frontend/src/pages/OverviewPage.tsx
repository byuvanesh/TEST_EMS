import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useAlarmStore } from '@/context/AlarmStore'
import { buildOverviewData } from '@/mock/demoData'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { StackedPowerChart } from '@/components/charts/StackedPowerChart'
import { Card, CardHeader } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { LoadCard } from '@/components/ui/LoadCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/cn'

export function OverviewPage() {
  const { openAlarms } = useAlarmStore()
  const data = buildOverviewData(openAlarms)
  const topAlarms = openAlarms.slice(0, 5)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description="Site electrical summary. Electrical monitoring only — no load control."
      />

      <DataStateBanner
        state={data.globalDataState}
        message="All values on this screen are DEMO DATA from one shared series. Energy today matches the Energy page (incomplete day through the DEMO snapshot). Not live meters."
      />

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        aria-label="Key performance indicators"
      >
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <section aria-label="Loads">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Loads</h2>
          <StatusBadge state="DEMO" compact />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.loads.map((load) => (
            <LoadCard key={load.loadId} reading={load} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="24-hour power by load"
            subtitle="DEMO DATA · canonical series · per-load lines · missing load = gap (not zero)"
            action={<StatusBadge state="DEMO" compact />}
          />
          <StackedPowerChart data={data.powerSeries} />
        </Card>

        <Card>
          <CardHeader
            title="Open alarms"
            subtitle="Active + acknowledged · DEMO thresholds"
            action={
              <Link to="/alarms" className="text-xs font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          <ul className="space-y-2">
            {topAlarms.map((alarm) => (
              <li
                key={alarm.id}
                className="rounded-[8px] border border-border bg-surface px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <SeverityBadge severity={alarm.severity} />
                  <StatusBadge state={alarm.dataState} compact />
                </div>
                <p className="mt-1.5 text-xs font-medium text-text">{alarm.title}</p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  {alarm.loadId ?? 'Site'} · {formatTimestamp(alarm.raisedAt)} ·{' '}
                  {alarm.status}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-label="Gateway communication">
        <Card>
          <CardHeader
            title="Gateway & communication"
            subtitle="Unverified hardware status — DEMO DATA only"
            action={<StatusBadge state={data.gateway.dataState} compact />}
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-surface text-text-secondary">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">{data.gateway.name}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{data.gateway.note}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:text-right">
              <div>
                <dt className="text-text-secondary">Link state</dt>
                <dd
                  className={cn(
                    'mt-0.5 font-medium capitalize',
                    data.gateway.linkState === 'unknown'
                      ? 'text-text-secondary'
                      : 'text-text',
                  )}
                >
                  {data.gateway.linkState}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Meters reporting</dt>
                <dd className="tabular mt-0.5 font-medium text-text">
                  {data.gateway.metersOnline} / {data.gateway.metersTotal}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-text-secondary">Last heard</dt>
                <dd className="mt-0.5 font-medium text-text-secondary">
                  {data.gateway.lastHeardAt
                    ? formatTimestamp(data.gateway.lastHeardAt)
                    : 'Not available (demo)'}
                </dd>
              </div>
            </dl>
          </div>
        </Card>
      </section>
    </div>
  )
}
