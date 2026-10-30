import type { ReactNode } from 'react'
import {
  CHART_TOOLTIP_STYLE,
  formatChartMeasurement,
  formatIstChartTimestamp,
  type ChartUnit,
} from '@/lib/chartFormat'
import {
  buildPowerTooltipRows,
  type PowerTooltipRow,
} from '@/lib/powerChartModel'
import type { LoadId } from '@/types'

interface TooltipPayloadItem {
  name?: string | number
  dataKey?: string | number
  value?: number | null
  color?: string
  payload?: Record<string, unknown>
}

interface SeriesTooltipProps {
  active?: boolean
  label?: string | number
  payload?: TooltipPayloadItem[]
  unit: ChartUnit
  /** Prefer ISO timestamp from the row when present. */
  timestampKey?: string
  title?: string
  /**
   * When set, always render these load keys from the raw row so mixed-null
   * samples still show "No data" for missing loads (Recharts may omit them).
   */
  alwaysShowLoadIds?: boolean
}

function headingFromPayload(
  label: string | number | undefined,
  row: Record<string, unknown> | undefined,
  timestampKey: string,
): string {
  const iso =
    row && typeof row[timestampKey] === 'string'
      ? String(row[timestampKey])
      : null
  return iso
    ? `${formatIstChartTimestamp(iso)} · DEMO DATA`
    : `${String(label ?? '')} · DEMO DATA`
}

export function SeriesTooltip({
  active,
  label,
  payload,
  unit,
  timestampKey = 'timestamp',
  title,
  alwaysShowLoadIds = false,
}: SeriesTooltipProps): ReactNode {
  if (!active) return null

  const row = payload?.[0]?.payload as
    | Partial<Record<LoadId, number | null>>
    | undefined
  const heading = headingFromPayload(
    label,
    row as Record<string, unknown> | undefined,
    timestampKey,
  )

  if (alwaysShowLoadIds) {
    const rows = buildPowerTooltipRows(row, unit)
    return (
      <PowerRowsTooltip title={title} heading={heading} rows={rows} />
    )
  }

  const items = payload ?? []
  const allMissing =
    items.length === 0 ||
    items.every(
      (item) => item.value === null || item.value === undefined,
    )

  return (
    <div style={CHART_TOOLTIP_STYLE}>
      {title ? (
        <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>{title}</p>
      ) : null}
      <p style={{ margin: 0, marginBottom: 6, color: '#64748B' }}>{heading}</p>
      {allMissing ? (
        <p style={{ margin: 0 }}>No data</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {items.map((item) => {
            const key = String(item.dataKey ?? item.name ?? 'value')
            return (
              <li
                key={key}
                style={{
                  margin: 0,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  lineHeight: 1.4,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: item.color ?? '#64748B',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#64748B' }}>{item.name ?? key}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatChartMeasurement(item.value, unit)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function PowerRowsTooltip({
  title,
  heading,
  rows,
}: {
  title?: string
  heading: string
  rows: PowerTooltipRow[]
}) {
  const allMissing = rows.every((r) => r.raw === null)
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      {title ? (
        <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>{title}</p>
      ) : null}
      <p style={{ margin: 0, marginBottom: 6, color: '#64748B' }}>{heading}</p>
      {allMissing ? (
        <p style={{ margin: 0 }}>No data</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {rows.map((row) => (
            <li
              key={row.loadId}
              style={{
                margin: 0,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: row.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#64748B' }}>{row.name}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {row.display}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface SingleValueTooltipProps {
  active?: boolean
  label?: string | number
  payload?: TooltipPayloadItem[]
  unit: ChartUnit
  seriesName: string
  timestampKey?: string
}

export function SingleValueTooltip({
  active,
  label,
  payload,
  unit,
  seriesName,
  timestampKey = 'timestamp',
}: SingleValueTooltipProps): ReactNode {
  if (!active) return null
  const item = payload?.[0]
  const row = item?.payload
  const heading = headingFromPayload(
    label,
    row as Record<string, unknown> | undefined,
    timestampKey,
  )

  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p style={{ margin: 0, marginBottom: 6, color: '#64748B' }}>{heading}</p>
      <p style={{ margin: 0 }}>
        <span style={{ color: '#64748B' }}>{seriesName}: </span>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatChartMeasurement(item?.value, unit)}
        </strong>
      </p>
    </div>
  )
}
