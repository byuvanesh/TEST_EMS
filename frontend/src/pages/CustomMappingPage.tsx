import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Save,
} from 'lucide-react'
import {
  apiClient,
  type ApiMeter,
  type ApiMappingItem,
} from '@/api/client'
import { DataStateBanner } from '@/components/layout/DataStateBanner'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

const DECODE_TYPES = ['number', 'uint16', 'int16', 'uint32', 'int32', 'float32'] as const
const BYTE_ORDER_TYPES = ['BE', 'LE'] as const
const WORD_ORDER_TYPES = ['BE', 'LE'] as const
const FUNCTION_CODES = ['FC03', 'FC04'] as const

const PARAMETER_CATALOGUE = [
  { key: 'voltage_l1', label: 'L1 Voltage', unit: 'V', defaultSourceKey: 's1_a0', defaultDecode: 'float32', defaultScale: 0.1, defaultOffset: 0 },
  { key: 'voltage_l2', label: 'L2 Voltage', unit: 'V', defaultSourceKey: 's1_a1', defaultDecode: 'float32', defaultScale: 0.1, defaultOffset: 0 },
  { key: 'voltage_l3', label: 'L3 Voltage', unit: 'V', defaultSourceKey: 's1_a2', defaultDecode: 'float32', defaultScale: 0.1, defaultOffset: 0 },
  { key: 'current_l1', label: 'L1 Current', unit: 'A', defaultSourceKey: 's1_a3', defaultDecode: 'float32', defaultScale: 0.01, defaultOffset: 0 },
  { key: 'current_l2', label: 'L2 Current', unit: 'A', defaultSourceKey: 's1_a4', defaultDecode: 'float32', defaultScale: 0.01, defaultOffset: 0 },
  { key: 'current_l3', label: 'L3 Current', unit: 'A', defaultSourceKey: 's1_a5', defaultDecode: 'float32', defaultScale: 0.01, defaultOffset: 0 },
  { key: 'active_power_kw', label: 'Active Power', unit: 'kW', defaultSourceKey: 's1_a6', defaultDecode: 'float32', defaultScale: 0.001, defaultOffset: 0 },
  { key: 'active_import_kwh', label: 'Energy Import', unit: 'kWh', defaultSourceKey: 's1_a8', defaultDecode: 'float32', defaultScale: 0.01, defaultOffset: 0 },
  { key: 'reactive_power_kvar', label: 'Reactive Power', unit: 'kVAR', defaultSourceKey: 's1_a10', defaultDecode: 'float32', defaultScale: 0.001, defaultOffset: 0 },
  { key: 'apparent_power_kva', label: 'Apparent Power', unit: 'kVA', defaultSourceKey: 's1_a12', defaultDecode: 'float32', defaultScale: 0.001, defaultOffset: 0 },
  { key: 'power_factor', label: 'Power Factor', unit: 'PF', defaultSourceKey: 's1_a14', defaultDecode: 'float32', defaultScale: 0.01, defaultOffset: 0 },
  { key: 'frequency_hz', label: 'Frequency', unit: 'Hz', defaultSourceKey: 's1_a15', defaultDecode: 'float32', defaultScale: 0.01, defaultOffset: 0 },
] as const

interface MappingFormState {
  sourceKey: string
  functionCode: (typeof FUNCTION_CODES)[number]
  decode: (typeof DECODE_TYPES)[number]
  registerCount: number
  byteOrder: (typeof BYTE_ORDER_TYPES)[number]
  wordOrder: (typeof WORD_ORDER_TYPES)[number]
  scale: string
  offset: string
  unit: string
  verificationStatus: 'UNVERIFIED' | 'VERIFIED'
  verifiedBy: string
  verifiedAt: string
  evidenceNote: string
  dirty: boolean
  saving: boolean
  saveError: string | null
  saveOk: boolean
}

function createEmptyMappingForm(param: (typeof PARAMETER_CATALOGUE)[number]): MappingFormState {
  return {
    sourceKey: param.defaultSourceKey,
    functionCode: 'FC03',
    decode: param.defaultDecode,
    registerCount: param.defaultDecode === 'float32' ? 2 : 1,
    byteOrder: 'BE',
    wordOrder: 'BE',
    scale: String(param.defaultScale),
    offset: String(param.defaultOffset),
    unit: param.unit,
    verificationStatus: 'UNVERIFIED',
    verifiedBy: '',
    verifiedAt: '',
    evidenceNote: '',
    dirty: false,
    saving: false,
    saveError: null,
    saveOk: false,
  }
}

function deriveRegisterCount(decode: (typeof DECODE_TYPES)[number]): number {
  switch (decode) {
    case 'uint32':
    case 'int32':
    case 'float32':
      return 2
    case 'number':
    case 'uint16':
    case 'int16':
      return 1
    default:
      return 1
  }
}

function verificationErrors(
  status: 'UNVERIFIED' | 'VERIFIED',
  verifiedBy: string,
  verifiedAt: string,
  evidenceNote: string,
): string[] {
  if (status !== 'VERIFIED') return []
  const errs: string[] = []
  if (!verifiedBy.trim()) errs.push('Verified by is required when VERIFIED')
  if (!verifiedAt.trim()) errs.push('Verified at is required when VERIFIED')
  if (!evidenceNote.trim()) errs.push('Evidence note is required when VERIFIED')
  return errs
}

interface SlaveMappingCardProps {
  slaveId: number
  label: string
  meterId: string
  mappings: ApiMappingItem[]
  onSave: () => Promise<void>
}

export function SlaveMappingCard({
  slaveId,
  label,
  meterId,
  mappings,
  onSave,
}: SlaveMappingCardProps) {
  const [forms, setForms] = useState<Record<string, MappingFormState>>({})
  const [expanded, setExpanded] = useState(true)

  // Initialize forms from API mappings
  useEffect(() => {
    const newForms: Record<string, MappingFormState> = {}
    for (const param of PARAMETER_CATALOGUE) {
      const existing = mappings.find((m) => m.metric === param.key)
      if (existing) {
        const sourceKeys = Array.isArray(existing.source_keys)
          ? existing.source_keys
          : typeof existing.source_keys === 'string'
            ? JSON.parse(existing.source_keys)
            : []
        newForms[param.key] = {
          sourceKey: sourceKeys[0] ?? param.defaultSourceKey,
          functionCode: 'FC03',
          decode: existing.decode,
          registerCount: deriveRegisterCount(existing.decode),
          byteOrder: existing.byte_order,
          wordOrder: existing.word_order,
          scale: String(existing.scale),
          offset: String(existing.offset),
          unit: existing.unit,
          verificationStatus: existing.verification_status,
          verifiedBy: existing.verified_by ?? '',
          verifiedAt: existing.verified_at ?? '',
          evidenceNote: existing.evidence_note ?? '',
          dirty: false,
          saving: false,
          saveError: null,
          saveOk: false,
        }
      } else {
        newForms[param.key] = createEmptyMappingForm(param)
      }
    }
    setForms(newForms)
  }, [mappings])

  const verifiedCount = mappings.filter((m) => m.verification_status === 'VERIFIED').length
  const totalCount = PARAMETER_CATALOGUE.length

  const handleChange = (paramKey: string, patch: Partial<MappingFormState>) => {
    setForms((prev) => ({
      ...prev,
      [paramKey]: { ...prev[paramKey], ...patch, dirty: true, saveOk: false },
    }))
  }

  const handleSave = async (paramKey: string) => {
    const form = forms[paramKey]
    if (!form || form.saving) return

    const errors = verificationErrors(
      form.verificationStatus,
      form.verifiedBy,
      form.verifiedAt,
      form.evidenceNote,
    )
    if (errors.length > 0) {
      setForms((prev) => ({
        ...prev,
        [paramKey]: { ...prev[paramKey], saveError: errors.join('; ') },
      }))
      return
    }

    setForms((prev) => ({
      ...prev,
      [paramKey]: { ...prev[paramKey], saving: true, saveError: null },
    }))

    try {
      await apiClient.putSystemMapping({
        meter_id: meterId,
        mappings: [
          {
            metric: paramKey,
            source_keys: [form.sourceKey],
            decode: form.decode,
            word_order: form.wordOrder,
            byte_order: form.byteOrder,
            scale: Number(form.scale) || 1,
            offset: Number(form.offset) || 0,
            unit: form.unit,
            verification_status: form.verificationStatus,
            verified_by: form.verifiedBy || null,
            verified_at: form.verifiedAt || null,
            evidence_note: form.evidenceNote || null,
          },
        ],
      })
      setForms((prev) => ({
        ...prev,
        [paramKey]: {
          ...prev[paramKey],
          saving: false,
          dirty: false,
          saveOk: true,
          saveError: null,
        },
      }))
      onSave()
    } catch (err) {
      setForms((prev) => ({
        ...prev,
        [paramKey]: {
          ...prev[paramKey],
          saving: false,
          saveError: err instanceof Error ? err.message : 'Save failed',
        },
      }))
    }
  }

  const handleDiscard = (paramKey: string) => {
    setForms((prev) => ({
      ...prev,
      [paramKey]: {
        ...prev[paramKey],
        dirty: false,
        saveOk: false,
        saveError: null,
      },
    }))
  }

  return (
    <Card className="rounded-[10px] border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text">
              {label} (Slave {slaveId})
            </h3>
            <p className="text-[10px] text-text-secondary">
              {verifiedCount} VERIFIED / {totalCount} parameters · Meter: {meterId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge
              state={
                verifiedCount === totalCount ? 'LIVE' : verifiedCount > 0 ? 'UNVERIFIED' : 'NO_DATA'
              }
              compact
            />
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-[6px] p-1.5 text-text-secondary hover:bg-surface hover:text-text transition-colors"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="divide-y divide-border/60">
          {PARAMETER_CATALOGUE.map((param) => {
            const form = forms[param.key]
            if (!form) return null
            const errors = verificationErrors(
              form.verificationStatus,
              form.verifiedBy,
              form.verifiedAt,
              form.evidenceNote,
            )

            return (
              <div
                key={param.key}
                className="border-b border-border/60 px-4 py-3 sm:px-5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-semibold sm:font-normal text-text truncate">
                      {param.label}
                    </span>
                    <span className="text-[10px] text-text-secondary">{param.unit}</span>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase shrink-0',
                      form.verificationStatus === 'VERIFIED'
                        ? 'border border-success/30 bg-success/10 text-success'
                        : 'border border-amber-500/30 bg-amber-500/10 text-amber-700',
                    )}
                  >
                    {form.verificationStatus}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-[6px] border border-border bg-card p-2">
                    <p className="text-[10px] font-medium text-text-secondary">Source Key</p>
                    <input
                      type="text"
                      value={form.sourceKey}
                      onChange={(e) =>
                        handleChange(param.key, { sourceKey: e.target.value })
                      }
                      className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] font-mono text-text outline-none focus:border-accent"
                    />
                  </div>

                  <div className="rounded-[6px] border border-border bg-card p-2">
                    <p className="text-[10px] font-medium text-text-secondary">Decode</p>
                    <select
                      value={form.decode}
                      onChange={(e) =>
                        handleChange(param.key, {
                          decode: e.target.value as (typeof DECODE_TYPES)[number],
                          registerCount: deriveRegisterCount(
                            e.target.value as (typeof DECODE_TYPES)[number],
                          ),
                        })}
                      className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                    >
                      {DECODE_TYPES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-[6px] border border-border bg-card p-2">
                    <p className="text-[10px] font-medium text-text-secondary">Register Count</p>
                    <input
                      type="number"
                      value={form.registerCount}
                      onChange={(e) =>
                        handleChange(param.key, { registerCount: parseInt(e.target.value) || 1 })
                      }
                      className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-3 mt-2">
                  <div className="rounded-[6px] border border-border bg-card p-2">
                    <p className="text-[10px] font-medium text-text-secondary">Scale</p>
                    <input
                      type="number"
                      step="any"
                      value={form.scale}
                      onChange={(e) => handleChange(param.key, { scale: e.target.value })}
                      className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                    />
                  </div>
                  <div className="rounded-[6px] border border-border bg-card p-2">
                    <p className="text-[10px] font-medium text-text-secondary">Offset</p>
                    <input
                      type="number"
                      step="any"
                      value={form.offset}
                      onChange={(e) => handleChange(param.key, { offset: e.target.value })}
                      className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                    />
                  </div>
                  <div className="rounded-[6px] border border-border bg-card p-2">
                    <p className="text-[10px] font-medium text-text-secondary">Unit</p>
                    <input
                      type="text"
                      value={form.unit}
                      onChange={(e) => handleChange(param.key, { unit: e.target.value })}
                      className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {form.verificationStatus === 'VERIFIED' && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mt-2">
                    <div className="rounded-[6px] border border-border bg-card p-2">
                      <p className="text-[10px] font-medium text-text-secondary">Verified By</p>
                      <input
                        type="text"
                        value={form.verifiedBy}
                        onChange={(e) => handleChange(param.key, { verifiedBy: e.target.value })}
                        className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                      />
                    </div>
                    <div className="rounded-[6px] border border-border bg-card p-2">
                      <p className="text-[10px] font-medium text-text-secondary">Verified At</p>
                      <input
                        type="datetime-local"
                        value={form.verifiedAt}
                        onChange={(e) => handleChange(param.key, { verifiedAt: e.target.value })}
                        className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                      />
                    </div>
                    <div className="rounded-[6px] border border-border bg-card p-2">
                      <p className="text-[10px] font-medium text-text-secondary">Evidence Note</p>
                      <input
                        type="text"
                        value={form.evidenceNote}
                        onChange={(e) => handleChange(param.key, { evidenceNote: e.target.value })}
                        className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                )}

                {errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[10px] text-error" role="alert">
                    {errors.map((e) => (
                      <li key={e}>• {e}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSave(param.key)}
                    disabled={!form.dirty || form.saving}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] bg-accent px-3.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Save className="h-3 w-3" />
                    {form.saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDiscard(param.key)}
                    disabled={!form.dirty}
                    className="h-8 rounded-[6px] border border-border px-3 text-xs text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Discard
                  </button>
                  {form.saveOk && (
                    <span className="flex items-center gap-1 text-[10px] text-success font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Saved
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export function CustomMappingPage() {
  const [meters, setMeters] = useState<ApiMeter[]>([])
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [globalSaving, setGlobalSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchMappings() {
      try {
        const res = await apiClient.getSystemMapping()
        if (!cancelled) {
          setMeters(res.meters)
          if (res.meters.length > 0 && !selectedMeterId) {
            setSelectedMeterId(res.meters[0].id)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to fetch mappings.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchMappings()
    return () => {
      cancelled = true
    }
  }, [selectedMeterId])

  const selectedMeter = meters.find((m) => m.id === selectedMeterId)
  const mappings = selectedMeter?.mappings ?? []

  const handleSave = async () => {
    setGlobalSaving(true)
    try {
      await apiClient.getSystemMapping() // Refresh
    } finally {
      setGlobalSaving(false)
    }
  }

  const handleResetDefaults = async () => {
    if (!selectedMeterId) return
    setGlobalSaving(true)
    try {
      await apiClient.resetMappingDefaults({ meter_id: selectedMeterId })
      const res = await apiClient.getSystemMapping()
      setMeters(res.meters)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setGlobalSaving(false)
    }
  }

  if (loading && !meters.length) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-8 text-center text-sm text-text-secondary">
        Loading meter mappings…
      </div>
    )
  }

  if (error) {
    return (
      <DataStateBanner state="OFFLINE" message={error} />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom Modbus Register Mapping"
        description="Configure Modbus register mappings for each slave meter. 48 parameter slots across 4 slaves."
        actions={
          <div className="flex items-center gap-2">
            {selectedMeter && (
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={globalSaving}
                className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reset Defaults
              </button>
            )}
          </div>
        }
      />

      {error && <DataStateBanner state="OFFLINE" message={error} />}

      {/* Slave Selector */}
      <Card className="rounded-[10px] border border-border bg-card shadow-sm">
        <CardHeader
          title="Select Slave Meter"
        />
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {meters.map((meter) => {
              const verifiedCount = meter.mappings.filter(
                (m) => m.verification_status === 'VERIFIED',
              ).length
              const isSelected = meter.id === selectedMeterId
              return (
                <button
                  key={meter.id}
                  onClick={() => setSelectedMeterId(meter.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-[8px] border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:bg-surface hover:border-text-secondary/50',
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meter.slave_id === 1 ? '#DB2777' : meter.slave_id === 2 ? '#3B82F6' : meter.slave_id === 3 ? '#0D9488' : '#7C3AED' }}
                    />
                    <span className="font-semibold text-text truncate">{meter.label}</span>
                  </div>
                  <p className="text-[10px] text-text-secondary">
                    Slave {meter.slave_id ?? '?'}
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase mt-1',
                      verifiedCount === 12
                        ? 'border border-success/30 bg-success/10 text-success'
                        : verifiedCount > 0
                          ? 'border border-amber-500/30 bg-amber-500/10 text-amber-700'
                          : 'border border-border bg-surface text-text-secondary',
                    )}
                  >
                    {verifiedCount} / 12 Verified
                  </span>
                </button>
              )
            })}
          </div>
          {meters.length === 0 && (
            <EmptyState
              title="No meters found"
              description="No meter records exist for this gateway. Meters must be commissioned first."
            />
          )}
        </div>
      </Card>

      {selectedMeter && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text">
              Parameter Mappings — {selectedMeter.label}
            </h2>
            <div className="flex items-center gap-2">
              {selectedMeter.mappings.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.reload()
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              )}
            </div>
          </div>

          <SlaveMappingCard
            slaveId={selectedMeter.slave_id ?? 0}
            label={selectedMeter.label}
            meterId={selectedMeter.id}
            mappings={mappings}
            onSave={handleSave}
          />        </>
      )}
    </div>
  )
}