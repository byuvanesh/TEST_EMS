import { useEffect, useReducer, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FlaskConical,
  Key,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'
import {
  apiClient,
  type ApiMappingItem,
  type ApiMeter,
  type ApiBridgeStatusResponse,
  type ApiGatewayMeterState,
  type ApiSystemConfigResponse,
  type ApiSystemGatewayResponse,
  type ApiSystemMappingResponse,
  type ApiTestMappingResponse,
} from '@/api/client'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useAuth } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function verificationErrors(
  status: 'UNVERIFIED' | 'VERIFIED',
  verifiedBy: string,
  verifiedAt: string,
  evidenceNote: string,
): string[] {
  if (status !== 'VERIFIED') return []
  const errs: string[] = []
  if (!verifiedBy.trim()) errs.push('verified_by is required when VERIFIED')
  if (!verifiedAt.trim()) errs.push('verified_at (ISO date) is required when VERIFIED')
  if (!evidenceNote.trim()) errs.push('evidence_note must not be empty when VERIFIED')
  return errs
}

function bridgeStatusColor(status: string): string {
  if (status === 'connected') return 'text-success'
  if (status === 'polling') return 'text-amber-500'
  if (status === 'disabled') return 'text-text-secondary'
  return 'text-error'
}

function BridgeStatusIcon({ status }: { status: string }) {
  if (status === 'connected') return <Wifi className="h-4 w-4 text-success" />
  if (status === 'polling') return <Activity className="h-4 w-4 text-amber-500 animate-pulse" />
  if (status === 'disabled') return <WifiOff className="h-4 w-4 text-text-secondary" />
  return <WifiOff className="h-4 w-4 text-error" />
}

// ---------------------------------------------------------------------------
// Mapping Test Panel
// ---------------------------------------------------------------------------

const DECODE_TYPES = ['number', 'uint16', 'int16', 'uint32', 'int32', 'float32'] as const
type DecodeType = (typeof DECODE_TYPES)[number]

interface TestForm {
  meterId: string
  metric: string
  sourceKeys: string
  decode: DecodeType
  wordOrder: 'BE' | 'LE'
  byteOrder: 'BE' | 'LE'
  scale: string
  offset: string
  unit: string
  verificationStatus: 'UNVERIFIED' | 'VERIFIED'
}

function MappingTestPanel({
  meters,
  onPrefill,
}: {
  meters: ApiMeter[]
  onPrefill?: (form: TestForm) => void
}) {
  const [form, setForm] = useState<TestForm>({
    meterId: meters[0]?.id ?? '',
    metric: 'active_power_kw',
    sourceKeys: '',
    decode: 'float32',
    wordOrder: 'BE',
    byteOrder: 'BE',
    scale: '1',
    offset: '0',
    unit: 'kW',
    verificationStatus: 'UNVERIFIED',
  })
  const [result, setResult] = useState<ApiTestMappingResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<TestForm>) => setForm((f) => ({ ...f, ...patch }))

  if (onPrefill) {
    // expose setter so meter rows can prefill
    ;(onPrefill as unknown as { _set: typeof set })._set = set
  }

  const handleTest = async () => {
    const keys = form.sourceKeys
      .split(/[\s,]+/)
      .map((k) => k.trim())
      .filter(Boolean)
    if (!keys.length) {
      setError('Enter at least one source key.')
      return
    }
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiClient.testSystemMapping({
        meter_id: form.meterId || undefined,
        mapping: {
          metric: form.metric,
          source_keys: keys,
          decode: form.decode,
          word_order: form.wordOrder,
          byte_order: form.byteOrder,
          scale: Number(form.scale) || 1,
          offset: Number(form.offset) || 0,
          unit: form.unit,
          verification_status: form.verificationStatus,
        },
      })
      setResult(res)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Mapping Test"
        subtitle="POST /api/system/mapping/test — decode against the latest archived raw payload for this meter (ignores VERIFIED status)"
        action={<FlaskConical className="h-4 w-4 text-text-secondary" />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-medium text-text-secondary">Meter</span>
          <select
            id="test-meter-id"
            value={form.meterId}
            onChange={(e) => set({ meterId: e.target.value })}
            className="h-9 w-full min-w-0 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
          >
            {meters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} (slave {m.slave_id ?? '?'})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-medium text-text-secondary">Metric name</span>
          <input
            id="test-metric"
            type="text"
            value={form.metric}
            onChange={(e) => set({ metric: e.target.value })}
            placeholder="active_power_kw"
            className="h-9 w-full min-w-0 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent font-mono"
          />
        </label>

        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-medium text-text-secondary">Source keys (comma-sep)</span>
          <input
            id="test-source-keys"
            type="text"
            value={form.sourceKeys}
            onChange={(e) => set({ sourceKeys: e.target.value })}
            placeholder="reg_3000, reg_3001"
            className="h-9 w-full min-w-0 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent font-mono"
          />
        </label>

        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-medium text-text-secondary">Decode type</span>
          <select
            id="test-decode"
            value={form.decode}
            onChange={(e) => set({ decode: e.target.value as DecodeType })}
            className="h-9 w-full min-w-0 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
          >
            {DECODE_TYPES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-medium text-text-secondary">Word order / Byte order</span>
          <div className="flex gap-2">
            <select
              id="test-word-order"
              value={form.wordOrder}
              onChange={(e) => set({ wordOrder: e.target.value as 'BE' | 'LE' })}
              className="h-9 flex-1 min-w-0 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
            >
              <option value="BE">Word: BE</option>
              <option value="LE">Word: LE</option>
            </select>
            <select
              id="test-byte-order"
              value={form.byteOrder}
              onChange={(e) => set({ byteOrder: e.target.value as 'BE' | 'LE' })}
              className="h-9 flex-1 min-w-0 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
            >
              <option value="BE">Byte: BE</option>
              <option value="LE">Byte: LE</option>
            </select>
          </div>
        </div>

        {/* Scale / Offset / Unit: responsive 3-column subgrid */}
        <div className="grid grid-cols-3 gap-2 min-w-0 sm:col-span-2 lg:col-span-1">
          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-medium text-text-secondary">Scale</span>
            <input
              id="test-scale"
              type="number"
              step="any"
              value={form.scale}
              onChange={(e) => set({ scale: e.target.value })}
              placeholder="1"
              className="h-9 w-full min-w-0 rounded-[8px] border border-border bg-card px-2 text-sm text-text outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-medium text-text-secondary">Offset</span>
            <input
              id="test-offset"
              type="number"
              step="any"
              value={form.offset}
              onChange={(e) => set({ offset: e.target.value })}
              placeholder="0"
              className="h-9 w-full min-w-0 rounded-[8px] border border-border bg-card px-2 text-sm text-text outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-medium text-text-secondary">Unit</span>
            <input
              id="test-unit"
              type="text"
              value={form.unit}
              onChange={(e) => set({ unit: e.target.value })}
              placeholder="kW"
              className="h-9 w-full min-w-0 rounded-[8px] border border-border bg-card px-2 text-sm text-text outline-none focus:border-accent"
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <button
          id="btn-run-mapping-test"
          type="button"
          onClick={handleTest}
          disabled={submitting}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-accent px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FlaskConical className="h-4 w-4" />
          {submitting ? 'Running…' : 'Run test'}
        </button>
        <p className="text-[11px] text-text-secondary leading-relaxed">
          Uses <code className="rounded bg-surface px-1 text-[10px]">ignoreVerificationStatus:true</code> — UNVERIFIED mappings can be tested freely.
          This bypass is scoped to this endpoint only.
        </p>
      </div>

      {result && (
        <div className="mt-4 rounded-[8px] border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            {result.ok ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-error" />
            )}
            <span className="text-xs font-semibold text-text">
              {result.ok ? 'Decode successful' : `Error: ${result.error ?? 'NO_RAW_PAYLOAD_AVAILABLE'}`}
            </span>
          </div>
          {result.ok && (
            <>
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-medium text-text-secondary uppercase tracking-wide">
                  Decoded value
                </p>
                <p className="tabular text-2xl font-semibold text-text">
                  {result.decoded_value !== null ? (
                    <>
                      {result.decoded_value}{' '}
                      <span className="text-base font-normal text-text-secondary">{result.unit}</span>
                    </>
                  ) : (
                    <span className="text-text-secondary">null</span>
                  )}
                </p>
                {result.local_server_ts && (
                  <p className="mt-1 text-[11px] text-text-secondary">
                    Payload timestamp: {formatTimestamp(new Date(result.local_server_ts).toISOString())}
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-medium text-text-secondary uppercase tracking-wide">
                  Raw keys → values (from latest archived payload)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-secondary">
                        <th className="pb-1 pr-4 text-left font-medium">Key</th>
                        <th className="pb-1 text-left font-medium">Value in payload</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {Object.entries(result.raw_keys).map(([k, v]) => (
                        <tr key={k} className="border-b border-border/50">
                          <td className="py-1.5 pr-4 text-text-secondary">{k}</td>
                          <td className="py-1.5 text-text">
                            {v === null ? (
                              <span className="text-text-secondary">null</span>
                            ) : (
                              String(v)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-text-secondary">
                  Decode: <strong>{result.decode}</strong> · word {result.word_order} · byte {result.byte_order} ·
                  scale ×{result.scale} + {result.offset}
                </p>
              </div>
            </>
          )}
          {!result.ok && result.message && (
            <p className="mt-2 text-xs text-text-secondary">{result.message}</p>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Mapping edit row
// ---------------------------------------------------------------------------

interface MappingEditState {
  metric: string
  source_keys: string
  decode: ApiMappingItem['decode']
  word_order: 'BE' | 'LE'
  byte_order: 'BE' | 'LE'
  scale: string
  offset: string
  unit: string
  verification_status: 'UNVERIFIED' | 'VERIFIED'
  verified_by: string
  verified_at: string
  evidence_note: string
  dirty: boolean
  saving: boolean
  saveError: string | null
  saveOk: boolean
}

function fromApiMapping(m: ApiMappingItem): MappingEditState {
  return {
    metric: m.metric,
    source_keys: m.source_keys.join(', '),
    decode: m.decode,
    word_order: m.word_order,
    byte_order: m.byte_order,
    scale: String(m.scale),
    offset: String(m.offset),
    unit: m.unit,
    verification_status: m.verification_status,
    verified_by: m.verified_by ?? '',
    verified_at: m.verified_at ?? '',
    evidence_note: m.evidence_note ?? '',
    dirty: false,
    saving: false,
    saveError: null,
    saveOk: false,
  }
}

function MappingRow({
  mapping,
  meterId,
  onSaved,
}: {
  mapping: ApiMappingItem
  meterId: string
  onSaved: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [s, setS] = useState<MappingEditState>(() => fromApiMapping(mapping))

  const patch = (p: Partial<MappingEditState>) =>
    setS((prev) => ({ ...prev, ...p, dirty: true, saveOk: false }))

  const evidenceErrors = verificationErrors(
    s.verification_status,
    s.verified_by,
    s.verified_at,
    s.evidence_note,
  )
  const canSave = s.dirty && evidenceErrors.length === 0 && !s.saving

  const handleSave = async () => {
    const keys = s.source_keys
      .split(/[\s,]+/)
      .map((k) => k.trim())
      .filter(Boolean)
    if (!keys.length) {
      setS((prev) => ({ ...prev, saveError: 'Source keys must not be empty.' }))
      return
    }
    setS((prev) => ({ ...prev, saving: true, saveError: null }))
    try {
      await apiClient.putSystemMapping({
        meter_id: meterId,
        mappings: [
          {
            metric: s.metric,
            source_keys: keys,
            decode: s.decode,
            word_order: s.word_order,
            byte_order: s.byte_order,
            scale: Number(s.scale) || 1,
            offset: Number(s.offset) || 0,
            unit: s.unit,
            verification_status: s.verification_status,
            verified_by: s.verified_by || null,
            verified_at: s.verified_at || null,
            evidence_note: s.evidence_note || null,
          },
        ],
      })
      setS((prev) => ({ ...prev, saving: false, dirty: false, saveOk: true }))
      onSaved()
    } catch (err) {
      setS((prev) => ({
        ...prev,
        saving: false,
        saveError: (err as Error).message,
      }))
    }
  }

  return (
    <li className="border-t border-border first:border-t-0">
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 px-3.5 py-3 sm:px-4 text-left hover:bg-surface/60 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="shrink-0 text-text-secondary">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="font-mono text-xs font-semibold sm:font-normal text-text truncate">
            {mapping.metric}
          </span>
          <span className="hidden sm:inline font-mono text-[11px] text-text-secondary truncate">
            [{mapping.source_keys.join(', ')}]
          </span>
          <span className="hidden sm:inline text-[11px] text-text-secondary">
            {mapping.decode}
          </span>
        </div>

        <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
          <span className="sm:hidden font-mono text-[11px] text-text-secondary truncate max-w-[130px]">
            [{mapping.source_keys.join(', ')}] · {mapping.decode}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase shrink-0',
              mapping.verification_status === 'VERIFIED'
                ? 'border border-success/30 bg-success/10 text-success'
                : 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
            )}
          >
            {mapping.verification_status}
          </span>
          {s.saveOk && (
            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
          )}
          <span className="text-[11px] text-text-secondary shrink-0">v{mapping.version}</span>
        </div>
      </button>

      {/* Expanded edit form */}
      {expanded && (
        <div className="border-t border-border bg-surface/40 px-3.5 py-4 sm:px-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] font-medium text-text-secondary">Source keys</span>
              <input
                type="text"
                value={s.source_keys}
                onChange={(e) => patch({ source_keys: e.target.value })}
                className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent font-mono"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] font-medium text-text-secondary">Decode type</span>
              <select
                value={s.decode}
                onChange={(e) => patch({ decode: e.target.value as ApiMappingItem['decode'] })}
                className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
              >
                {DECODE_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 min-w-0">
              <label className="flex flex-1 min-w-0 flex-col gap-1">
                <span className="text-[11px] font-medium text-text-secondary">Word order</span>
                <select
                  value={s.word_order}
                  onChange={(e) => patch({ word_order: e.target.value as 'BE' | 'LE' })}
                  className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                >
                  <option value="BE">BE</option>
                  <option value="LE">LE</option>
                </select>
              </label>
              <label className="flex flex-1 min-w-0 flex-col gap-1">
                <span className="text-[11px] font-medium text-text-secondary">Byte order</span>
                <select
                  value={s.byte_order}
                  onChange={(e) => patch({ byte_order: e.target.value as 'BE' | 'LE' })}
                  className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                >
                  <option value="BE">Byte: BE</option>
                  <option value="LE">Byte: LE</option>
                </select>
              </label>
            </div>
            {/* Scale, Offset, Unit: responsive 3-column subgrid */}
            <div className="grid grid-cols-3 gap-2 min-w-0 sm:col-span-2 lg:col-span-3">
              <label className="flex flex-col gap-1 min-w-0">
                <span className="text-[11px] font-medium text-text-secondary">Scale</span>
                <input
                  type="number"
                  step="any"
                  value={s.scale}
                  onChange={(e) => patch({ scale: e.target.value })}
                  className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1 min-w-0">
                <span className="text-[11px] font-medium text-text-secondary">Offset</span>
                <input
                  type="number"
                  step="any"
                  value={s.offset}
                  onChange={(e) => patch({ offset: e.target.value })}
                  className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1 min-w-0">
                <span className="text-[11px] font-medium text-text-secondary">Unit</span>
                <input
                  type="text"
                  value={s.unit}
                  onChange={(e) => patch({ unit: e.target.value })}
                  className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                />
              </label>
            </div>
          </div>

          {/* Verification fields */}
          <div className="rounded-[8px] border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text">Verification status</p>
              <select
                id={`verify-status-${mapping.id}`}
                value={s.verification_status}
                onChange={(e) =>
                  patch({ verification_status: e.target.value as 'UNVERIFIED' | 'VERIFIED' })
                }
                className={cn(
                  'h-7 rounded-[6px] border px-2 text-xs font-semibold outline-none focus:border-accent',
                  s.verification_status === 'VERIFIED'
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
                )}
              >
                <option value="UNVERIFIED">UNVERIFIED</option>
                <option value="VERIFIED">VERIFIED</option>
              </select>
            </div>

            {s.verification_status === 'VERIFIED' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1 min-w-0">
                  <span className="text-[11px] font-medium text-text-secondary">
                    Verified by <span className="text-error">*</span>
                  </span>
                  <input
                    id={`verified-by-${mapping.id}`}
                    type="text"
                    value={s.verified_by}
                    onChange={(e) => patch({ verified_by: e.target.value })}
                    placeholder="engineer name"
                    className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 min-w-0">
                  <span className="text-[11px] font-medium text-text-secondary">
                    Verified at <span className="text-error">*</span>
                  </span>
                  <input
                    id={`verified-at-${mapping.id}`}
                    type="datetime-local"
                    value={s.verified_at}
                    onChange={(e) => patch({ verified_at: e.target.value })}
                    className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 min-w-0 sm:col-span-1">
                  <span className="text-[11px] font-medium text-text-secondary">
                    Evidence note <span className="text-error">*</span>
                  </span>
                  <input
                    id={`evidence-note-${mapping.id}`}
                    type="text"
                    value={s.evidence_note}
                    onChange={(e) => patch({ evidence_note: e.target.value })}
                    placeholder="bench test result / meter display match"
                    className="h-8 w-full min-w-0 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                  />
                </label>
              </div>
            )}

            {evidenceErrors.length > 0 && (
              <ul className="space-y-0.5 text-[11px] text-error" role="alert">
                {evidenceErrors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}
          </div>

          {s.saveError && (
            <p className="text-xs text-error" role="alert">
              {s.saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] bg-accent px-3.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {s.saving ? 'Saving…' : 'Save mapping'}
            </button>
            <button
              type="button"
              onClick={() => setS(fromApiMapping(mapping))}
              disabled={!s.dirty}
              className="h-8 rounded-[6px] border border-border px-3 text-xs text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              Discard
            </button>
            {s.saveOk && (
              <span className="flex items-center gap-1 text-xs text-success font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Meter accordion
// ---------------------------------------------------------------------------

function MeterCard({
  meter,
  onSaved,
}: {
  meter: ApiMeter
  onSaved: () => void
}) {
  const [open, setOpen] = useState(true)
  const verifiedCount = meter.mappings.filter(
    (m) => m.verification_status === 'VERIFIED',
  ).length

  return (
    <Card padding="none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 sm:p-4 md:px-5 md:py-4 hover:bg-surface/60 transition-colors text-left"
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="mt-0.5 shrink-0 text-text-secondary">
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-text break-words leading-snug">
              {meter.label}
            </h3>
            {/* Desktop single line */}
            <p className="hidden md:block text-[11px] text-text-secondary mt-0.5">
              Slave ID: {meter.slave_id ?? '?'} · Model: {meter.model ?? 'unknown'} · Gateway: {meter.gateway?.code ?? '—'} (MAC: {meter.gateway?.mac ?? '—'})
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-1.5 pl-6 md:pl-0 shrink-0">
          <span className="inline-flex items-center rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
            {verifiedCount} VERIFIED
          </span>
          <span className="text-[11px] text-text-secondary font-medium">/</span>
          <span className="text-[11px] text-text-secondary font-medium">
            {meter.mappings.length} metrics
          </span>
          {!meter.modbus_variant_verified && (
            <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Modbus unverified</span>
            </span>
          )}
        </div>

        {/* Mobile-only readable details grid */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px] pl-6 md:hidden w-full">
          <div className="rounded-[4px] border border-border/70 bg-surface/50 px-2 py-1">
            <span className="text-text-secondary">Slave ID: </span>
            <span className="font-mono font-medium text-text">{meter.slave_id ?? '?'}</span>
          </div>
          <div className="rounded-[4px] border border-border/70 bg-surface/50 px-2 py-1 truncate">
            <span className="text-text-secondary">Model: </span>
            <span className="font-medium text-text">{meter.model ?? 'unknown'}</span>
          </div>
          <div className="rounded-[4px] border border-border/70 bg-surface/50 px-2 py-1 truncate">
            <span className="text-text-secondary">Gateway: </span>
            <span className="font-mono font-medium text-text">{meter.gateway?.code ?? '—'}</span>
          </div>
          <div className="rounded-[4px] border border-border/70 bg-surface/50 px-2 py-1 truncate">
            <span className="text-text-secondary">MAC: </span>
            <span className="font-mono font-medium text-text">{meter.gateway?.mac ?? '—'}</span>
          </div>
        </div>
      </button>

      {open && meter.mappings.length > 0 && (
        <ul className="border-t border-border">
          {meter.mappings.map((m) => (
            <MappingRow
              key={m.id}
              mapping={m}
              meterId={meter.id}
              onSaved={onSaved}
            />
          ))}
        </ul>
      )}
      {open && meter.mappings.length === 0 && (
        <p className="border-t border-border px-4 py-3 sm:px-5 sm:py-4 text-xs text-text-secondary">
          No metric mappings configured for this meter yet.
        </p>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Bridge status card
// ---------------------------------------------------------------------------

function BridgeStatusCard({ bridge }: { bridge: ApiBridgeStatusResponse }) {
  const m = bridge.metrics
  return (
    <Card>
      <CardHeader
        title="Bridge status"
        subtitle="GET /api/bridge/status — connection mode and lifetime counters"
        action={<BridgeStatusIcon status={bridge.status} />}
      />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Status</p>
          <p className={cn('mt-1 text-sm font-semibold capitalize', bridgeStatusColor(bridge.status))}>
            {bridge.status}
          </p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Mode</p>
          <p className="mt-1 text-sm font-medium text-text capitalize">{bridge.mode}</p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Last receive</p>
          <p className="mt-1 font-mono text-[11px] font-medium text-text truncate">
            {bridge.last_receive_time
              ? formatTimestamp(bridge.last_receive_time)
              : '—'}
          </p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">WS frames</p>
          <p className="tabular tabular-nums mt-1 text-sm font-medium text-text">{m.wsFramesTotal}</p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Polls OK / Total</p>
          <p className="tabular tabular-nums mt-1 text-sm font-medium text-text">
            {m.pollsOk} / {m.pollsTotal}
          </p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Poll errors</p>
          <p
            className={cn(
              'tabular tabular-nums mt-1 text-sm font-medium',
              m.pollsError > 0 ? 'text-error' : 'text-text',
            )}
          >
            {m.pollsError}
          </p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Archive inserts</p>
          <p className="tabular tabular-nums mt-1 text-sm font-medium text-text">{m.archiveInserts}</p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Decode errors</p>
          <p
            className={cn(
              'tabular tabular-nums mt-1 text-sm font-medium',
              m.decodeErrors > 0 ? 'text-error' : 'text-text',
            )}
          >
            {m.decodeErrors}
          </p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Auth errors</p>
          <p
            className={cn(
              'tabular tabular-nums mt-1 text-sm font-medium',
              m.authErrors > 0 ? 'text-error' : 'text-text',
            )}
          >
            {m.authErrors}
          </p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">TS reversals</p>
          <p
            className={cn(
              'tabular tabular-nums mt-1 text-sm font-medium',
              m.tsReversals > 0 ? 'text-amber-500' : 'text-text',
            )}
          >
            {m.tsReversals}
          </p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Duplicates</p>
          <p className="tabular tabular-nums mt-1 text-sm font-medium text-text">{m.archiveDuplicates}</p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Oversized drops</p>
          <p
            className={cn(
              'tabular tabular-nums mt-1 text-sm font-medium',
              m.archiveOversized > 0 ? 'text-amber-500' : 'text-text',
            )}
          >
            {m.archiveOversized}
          </p>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Gateway status card
// ---------------------------------------------------------------------------

function GatewayStatusCard({ gw }: { gw: ApiSystemGatewayResponse }) {
  return (
    <Card>
      <CardHeader
        title="Gateway"
        subtitle="GET /api/system/gateway — meter states are gateway-level only"
        action={<Radio className="h-4 w-4 text-text-secondary" />}
      />
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Code</p>
          <p className="mt-1 font-mono text-xs font-semibold text-text">{gw.gateway.code}</p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">MAC</p>
          <p className="mt-1 font-mono text-text text-[11px] truncate">{gw.gateway.mac}</p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">Firmware</p>
          <p className="mt-1 text-xs font-medium text-text">{gw.gateway.firmware_version ?? '—'}</p>
        </div>
        <div className="rounded-[6px] border border-border/60 bg-surface/40 p-2.5 transition-colors hover:bg-surface/60">
          <p className="text-[11px] font-medium text-text-secondary">RS-485 master</p>
          <p
            className={cn(
              'mt-1 text-xs font-semibold',
              gw.gateway.rs485_master_verified ? 'text-success' : 'text-amber-500',
            )}
          >
            {gw.gateway.rs485_master_verified ? 'Verified' : 'Unverified'}
          </p>
        </div>
      </div>

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        Meter states (gateway-level only)
      </p>

      {/* Desktop table view (retained for tablet and desktop) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="pb-2 pr-4 text-left font-medium">Label</th>
              <th className="pb-2 pr-4 text-left font-medium">Slave ID</th>
              <th className="pb-2 pr-4 text-left font-medium">Status</th>
              <th className="pb-2 text-left font-medium">Assurance</th>
            </tr>
          </thead>
          <tbody>
            {gw.meters.map((m) => (
              <tr key={m.meter_id} className="border-b border-border/50">
                <td className="py-2 pr-4 font-medium text-text">{m.label}</td>
                <td className="py-2 pr-4 font-mono text-text-secondary">{m.slave_id ?? '—'}</td>
                <td className="py-2 pr-4">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase',
                      m.status === 'online'
                        ? 'border border-success/30 bg-success/10 text-success'
                        : 'border border-border bg-surface text-text-secondary',
                    )}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="py-2">
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    {m.state_assurance}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile responsive meter cards (prevents horizontal clipping at 390px and below) */}
      <div className="space-y-2 md:hidden">
        {gw.meters.map((m) => (
          <div
            key={m.meter_id}
            className="rounded-[6px] border border-border/80 bg-surface/50 p-2.5 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-text">{m.label}</span>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase',
                  m.status === 'online'
                    ? 'border border-success/30 bg-success/10 text-success'
                    : 'border border-border bg-card text-text-secondary',
                )}
              >
                {m.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/40 pt-1.5 text-[11px]">
              <span className="text-text-secondary">
                Slave ID: <span className="font-mono text-text">{m.slave_id ?? '—'}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                {m.state_assurance}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-text-secondary">
        {gw.meters[0]?.note}
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Gateway Registration & API Credentials Card
// ---------------------------------------------------------------------------

export interface GatewayRegistrationCardProps {
  gw: ApiSystemGatewayResponse
  isAdmin: boolean
  onSuccess: () => void
}

export function GatewayRegistrationCard({
  gw,
  isAdmin,
  onSuccess,
}: GatewayRegistrationCardProps) {
  const isRegistered = Boolean(gw.gateway.is_registered || (gw.gateway.mac && gw.gateway.has_auth_key))
  const [isFormOpen, setIsFormOpen] = useState(!isRegistered)
  const [name, setName] = useState(gw.gateway.name || 'Trikona Industrial Gateway')
  const [mac, setMac] = useState(gw.gateway.mac || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Auto-format MAC to uppercase XX:XX:XX:XX:XX:XX
  const handleMacChange = (val: string) => {
    const cleaned = val.toUpperCase().replace(/[^0-9A-F]/g, '')
    if (cleaned.length <= 12) {
      const parts = cleaned.match(/.{1,2}/g)
      setMac(parts ? parts.join(':') : cleaned)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    setError(null)

    const hexOnly = mac.toUpperCase().replace(/[^0-9A-F]/g, '')
    if (hexOnly.length !== 12) {
      setError('Please enter a valid 12-digit hex MAC address (e.g. AA:BB:CC:DD:EE:FF)')
      return
    }

    setLoading(true)
    try {
      const res = await apiClient.registerSystemGateway({
        name: name.trim(),
        mac: mac.trim(),
        gateway_id: gw.gateway.id,
      })
      setCreatedKey(res.api_key)
      setIsFormOpen(false)
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Failed to register gateway')
    } finally {
      setLoading(false)
    }
  }

  const copyKey = async () => {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback
    }
  }

  return (
    <Card>
      <CardHeader
        title="Gateway Registration & API Credentials"
        subtitle="Admin Commissioning · Connect physical Trikona ESP32 gateway to TEST_EMS"
        action={<ShieldCheck className="h-4 w-4 text-text-secondary" />}
      />

      {/* One-Time API Key Banner */}
      {createdKey && (
        <div
          id="banner-gateway-api-key"
          className="mb-4 rounded-[8px] border border-amber-500/40 bg-amber-500/10 p-4 text-xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-semibold text-amber-500 flex items-center gap-1.5">
                <Key className="h-4 w-4" />
                Gateway API Key Created Successfully
              </p>
              <p className="text-text-secondary text-[11px] leading-relaxed">
                <span className="font-semibold text-amber-500">Important:</span> Copy this API key now. It is stored securely as a cryptographic bcrypt hash on the backend and cannot be retrieved again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              className="text-[11px] text-text-secondary hover:text-text px-2 py-1 rounded border border-border/60 hover:bg-surface"
            >
              Dismiss
            </button>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              value={createdKey}
              id="input-created-api-key"
              className="flex-1 rounded-[6px] border border-border bg-card px-3 py-2 font-mono text-xs text-text select-all"
            />
            <button
              type="button"
              id="btn-copy-api-key"
              onClick={copyKey}
              className="inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-border bg-card px-3.5 py-2 text-xs font-semibold text-text hover:bg-surface transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Key'}
            </button>
          </div>

          <p className="mt-2 text-[10px] text-text-secondary">
            Configure this key on the ESP32 in <b>EMS Settings &gt; API key (emskey)</b> along with Base URL <b>http://&lt;server-ip&gt;:3001</b>.
          </p>
        </div>
      )}

      {/* Gateway Registration Summary Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[6px] border border-border/60 bg-surface/40 p-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text">{gw.gateway.name || gw.gateway.code}</span>
            {isRegistered ? (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase border border-success/30 bg-success/10 text-success">
                Registered
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase border border-amber-500/30 bg-amber-500/10 text-amber-500">
                Pending Registration
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-secondary mt-1">
            MAC: <span className="font-mono text-text">{gw.gateway.mac ?? 'None (Unregistered)'}</span> · Authentication: <span className="text-text">{isRegistered ? 'Bcrypt Hash Active' : 'Not Configured'}</span>
          </p>
        </div>

        {isAdmin && !isFormOpen && (
          <button
            type="button"
            id="btn-toggle-gateway-form"
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface"
          >
            {isRegistered ? 'Update MAC / Rotate Key' : 'Register Gateway'}
          </button>
        )}
      </div>

      {/* Non-Admin viewer notice */}
      {!isAdmin && (
        <div className="rounded-[6px] border border-border bg-surface/30 px-3 py-2 text-xs text-text-secondary">
          Administrator privileges are required to register physical gateways or generate API credentials.
        </div>
      )}

      {/* Admin Registration Form */}
      {isAdmin && isFormOpen && (
        <form onSubmit={handleRegister} className="space-y-3 rounded-[6px] border border-border bg-surface/30 p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="input-gw-name" className="block text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-1">
                Gateway Name
              </label>
              <input
                id="input-gw-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Trikona Main Incomer Gateway"
                className="w-full rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="input-gw-mac" className="block text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-1">
                ESP32 MAC Address
              </label>
              <input
                id="input-gw-mac"
                type="text"
                required
                value={mac}
                onChange={(e) => handleMacChange(e.target.value)}
                placeholder="e.g. 78:1C:3C:AA:5F:C8"
                className="w-full rounded-[6px] border border-border bg-card px-3 py-1.5 font-mono text-xs text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <p className="text-[10px] text-text-secondary leading-relaxed">
            Format: 12 hex digits (XX:XX:XX:XX:XX:XX). Read directly from the ESP32 Web Portal under <b>EMS Settings &gt; Active MAC</b> or USB Serial Monitor at boot.
          </p>

          {error && (
            <p className="text-xs text-error" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            {isRegistered && (
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false)
                  setError(null)
                }}
                className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              id="btn-submit-register-gateway"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
              {isRegistered ? 'Update MAC & Rotate Key' : 'Register Gateway & Generate Key'}
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Meter Modbus Commissioning Section
// ---------------------------------------------------------------------------

export interface MeterCommissioningCardProps {
  meters: ApiGatewayMeterState[]
  isAdmin: boolean
  onSuccess: () => void
}

export function MeterCommissioningCard({
  meters,
  isAdmin,
  onSuccess,
}: MeterCommissioningCardProps) {
  const [editingMeterId, setEditingMeterId] = useState<string | null>(null)
  const [slaveIdInput, setSlaveIdInput] = useState<string>('')
  const [verifiedInput, setVerifiedInput] = useState<boolean>(false)
  const [evidenceNoteInput, setEvidenceNoteInput] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = (m: ApiGatewayMeterState) => {
    setEditingMeterId(m.meter_id)
    setSlaveIdInput(m.slave_id !== null ? String(m.slave_id) : '')
    setVerifiedInput(Boolean(m.modbus_variant_verified))
    setEvidenceNoteInput('')
    setError(null)
  }

  const cancelEdit = () => {
    setEditingMeterId(null)
    setError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMeterId || !isAdmin) return
    setError(null)

    const parsedSlaveId = parseInt(slaveIdInput, 10)
    if (isNaN(parsedSlaveId) || parsedSlaveId < 1 || parsedSlaveId > 247) {
      setError('Modbus Slave ID must be an integer between 1 and 247')
      return
    }

    // Check for duplicate Slave ID among other meters
    const duplicate = meters.find(
      (m) => m.meter_id !== editingMeterId && m.slave_id === parsedSlaveId,
    )
    if (duplicate) {
      setError(`Modbus Slave ID ${parsedSlaveId} is already assigned to meter "${duplicate.label}" on this gateway`)
      return
    }

    if (verifiedInput && !evidenceNoteInput.trim()) {
      setError('Evidence note is required when marking a meter Modbus variant as verified')
      return
    }

    setLoading(true)
    try {
      await apiClient.commissionSystemMeter(editingMeterId, {
        slave_id: parsedSlaveId,
        modbus_variant_verified: verifiedInput,
        evidence_note: evidenceNoteInput.trim() || undefined,
      })
      setEditingMeterId(null)
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Failed to commission meter')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Meter Modbus Commissioning"
        subtitle="Assign verified Modbus RTU Slave IDs to site meters · Prevents RS485 bus address collisions"
        action={<Radio className="h-4 w-4 text-text-secondary" />}
      />

      <div className="space-y-3">
        {meters.map((m) => {
          const isEditing = editingMeterId === m.meter_id
          const hasSlaveId = m.slave_id !== null

          return (
            <div
              key={m.meter_id}
              className="rounded-[6px] border border-border/80 bg-surface/40 p-3 transition-colors hover:bg-surface/60"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text">{m.label}</span>
                    {hasSlaveId ? (
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border border-sky-500/30 bg-sky-500/10 text-sky-400">
                        Slave ID: {m.slave_id}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-500">
                        Pending Commissioning
                      </span>
                    )}

                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold',
                        m.modbus_variant_verified
                          ? 'border border-success/30 bg-success/10 text-success'
                          : 'border border-amber-500/30 bg-amber-500/10 text-amber-500',
                      )}
                    >
                      {m.modbus_variant_verified
                        ? 'Modbus Variant Verified (Config)'
                        : 'Modbus Variant Unverified (Config)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1">
                    State: <span className="text-text capitalize">{m.status}</span> · Assurance: <span className="text-text">{m.state_assurance}</span>
                  </p>
                </div>

                {isAdmin && !isEditing && (
                  <button
                    type="button"
                    onClick={() => startEdit(m)}
                    className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface"
                  >
                    {hasSlaveId ? 'Edit Slave ID' : 'Commission'}
                  </button>
                )}
              </div>

              {/* Inline Commissioning Form */}
              {isEditing && (
                <form onSubmit={handleSave} className="mt-3 pt-3 border-t border-border/60 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-1">
                        Modbus RTU Slave ID (1..247)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={247}
                        required
                        value={slaveIdInput}
                        onChange={(e) => setSlaveIdInput(e.target.value)}
                        placeholder="e.g. 1"
                        className="w-full rounded-[6px] border border-border bg-card px-3 py-1.5 font-mono text-xs text-text focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-text">
                        <input
                          type="checkbox"
                          checked={verifiedInput}
                          onChange={(e) => setVerifiedInput(e.target.checked)}
                          className="rounded border-border text-accent focus:ring-0"
                        />
                        <span>Confirm Modbus Variant Verified</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-1">
                      Commissioning Evidence Note {verifiedInput && <span className="text-amber-500">* (Required)</span>}
                    </label>
                    <textarea
                      rows={2}
                      value={evidenceNoteInput}
                      onChange={(e) => setEvidenceNoteInput(e.target.value)}
                      placeholder="e.g., Verified Slave ID 1 on Schneider EM6400 front display, baud 9600 8N1"
                      className="w-full rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs text-text placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-error" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-[6px] bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
                    >
                      {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
                      Save Commissioning
                    </button>
                  </div>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// local_server Registration Convenience Card
// ---------------------------------------------------------------------------

/**
 * Renders the LOCAL_SERVER_URL field and a button that opens
 * `${local_server_url}/devices` in a new tab so the operator can register
 * the gateway on local_server themselves.
 *
 * Design constraints:
 * - This component never POSTs or fetches anything from local_server.
 * - It is purely a navigation convenience: window.open / target="_blank".
 * - No form fields for MAC or API key are submitted anywhere from here.
 */
interface LocalServerRegistrationCardProps {
  config: ApiSystemConfigResponse | null
  loading?: boolean
  error?: string | null
}

/**
 * Renders the LOCAL_SERVER_URL field and a button that opens
 * `${local_server_url}/devices` in a new tab so the operator can register
 * the gateway on local_server themselves.
 *
 * Design constraints:
 * - Always rendered even if configuration is missing or endpoint errored.
 * - If URL is unavailable, displays a configuration warning and disables the button.
 * - This component never POSTs or fetches anything from local_server.
 * - It is purely a navigation convenience: window.open / target="_blank".
 * - No form fields for MAC or API key are submitted anywhere from here.
 */
export function LocalServerRegistrationCard({
  config,
  loading = false,
  error = null,
}: LocalServerRegistrationCardProps) {
  const url = config?.local_server_url?.trim() || ''
  const isAvailable = Boolean(url && !error)
  const registrationUrl = isAvailable ? `${url}/devices` : '#'

  return (
    <Card>
      <CardHeader
        title="local_server — Gateway Registration"
        subtitle="Convenience link only · TEST_EMS does not write to local_server"
        action={<ExternalLink className="h-4 w-4 text-text-secondary" />}
      />

      {/* Warning banner when URL is unavailable */}
      {!isAvailable && !loading && (
        <div
          id="local-server-config-warning"
          className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500"
        >
          {error
            ? `local_server URL unavailable: ${error}`
            : 'LOCAL_SERVER_URL is not configured on the backend.'}
        </div>
      )}

      {/* LOCAL_SERVER_URL labeled field */}
      <div className="mb-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          LOCAL_SERVER_URL (from backend config)
        </p>
        <p
          id="local-server-url-display"
          className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text break-all"
        >
          {loading ? 'Loading…' : url || '(not configured)'}
        </p>
      </div>

      {/* Open local_server devices page or disabled button */}
      {isAvailable ? (
        <a
          id="btn-register-gateway-local-server"
          href={registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-[8px] border border-border bg-card px-4 py-2 text-xs font-medium text-text transition-colors hover:bg-surface"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Register gateway on local_server
        </a>
      ) : (
        <button
          id="btn-register-gateway-local-server"
          disabled
          aria-disabled="true"
          title="local_server URL is unavailable"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-[8px] border border-border bg-card px-4 py-2 text-xs font-medium text-text-secondary opacity-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Register gateway on local_server
        </button>
      )}

      {/* Instructions — plain text, no form interaction */}
      <p className="mt-4 text-[11px] leading-relaxed text-text-secondary">
        Log in with your local_server admin account, click{' '}
        <span className="font-semibold text-text">Add device</span>, enter the
        gateway MAC and a name, then copy the generated API key and URL into
        the gateway firmware&apos;s{' '}
        <span className="font-semibold text-text">Local server settings</span> page.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type FetchState<T> = { data: T | null; loading: boolean; error: string | null }

function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  })
  // track whether mounted
  const mountedRef = useRef(true)
  const [tick, bump] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    mountedRef.current = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fetcher()
      .then((data) => {
        if (mountedRef.current) setState({ data, loading: false, error: null })
      })
      .catch((err: Error) => {
        if (mountedRef.current)
          setState({ data: null, loading: false, error: err.message })
      })
    return () => {
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, refresh: bump }
}

export function SystemPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const mapping = useFetch<ApiSystemMappingResponse>(
    () => apiClient.getSystemMapping(),
    [],
  )
  const gateway = useFetch<ApiSystemGatewayResponse>(
    () => apiClient.getSystemGateway(),
    [],
  )
  const bridge = useFetch<ApiBridgeStatusResponse>(
    () => apiClient.getBridgeStatus(),
    [],
  )
  const sysConfig = useFetch<ApiSystemConfigResponse>(
    () => apiClient.getSystemConfig(),
    [],
  )

  const reload = () => {
    mapping.refresh()
    gateway.refresh()
    bridge.refresh()
    sysConfig.refresh()
  }

  const overallLoading = mapping.loading || gateway.loading || bridge.loading

  return (
    <div className="space-y-6">
      <PageHeader
        title="System"
        description="Meter mapping admin, mapping test tool, gateway status, and bridge diagnostics."
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge state="UNKNOWN" />
            <button
              type="button"
              id="btn-system-refresh"
              onClick={reload}
              disabled={overallLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-border/80 bg-surface/50 px-3 text-xs font-medium text-text shadow-xs transition-all hover:bg-surface hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', overallLoading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Bridge + Gateway status row */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {bridge.error ? (
          <Card>
            <p className="text-xs text-error">Bridge status unavailable: {bridge.error}</p>
          </Card>
        ) : bridge.data ? (
          <BridgeStatusCard bridge={bridge.data} />
        ) : (
          <Card>
            <p className="text-xs text-text-secondary">Loading bridge status…</p>
          </Card>
        )}

        {gateway.error ? (
          <Card>
            <p className="text-xs text-error">Gateway status unavailable: {gateway.error}</p>
          </Card>
        ) : gateway.data ? (
          <GatewayStatusCard gw={gateway.data} />
        ) : (
          <Card>
            <p className="text-xs text-text-secondary">Loading gateway status…</p>
          </Card>
        )}
      </div>

      {/* Gateway Registration & Credential Generation (Admin-controlled) */}
      {gateway.data && (
        <GatewayRegistrationCard
          gw={gateway.data}
          isAdmin={isAdmin}
          onSuccess={reload}
        />
      )}

      {/* Meter Modbus Commissioning Section */}
      {gateway.data && gateway.data.meters.length > 0 && (
        <MeterCommissioningCard
          meters={gateway.data.meters}
          isAdmin={isAdmin}
          onSuccess={reload}
        />
      )}

      {/* local_server registration convenience card — always rendered */}
      <LocalServerRegistrationCard
        config={sysConfig.data}
        loading={sysConfig.loading}
        error={sysConfig.error}
      />

      {/* Mapping Test Tool */}
      {mapping.data && mapping.data.meters.length > 0 ? (
        <MappingTestPanel meters={mapping.data.meters} />
      ) : mapping.loading ? null : (
        <Card>
          <p className="text-xs text-text-secondary">No meters available for mapping test.</p>
        </Card>
      )}

      {/* Meter mapping admin */}
      <section aria-label="Metric mappings">
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h2 className="text-sm font-semibold text-text">Metric mappings</h2>
          <p className="text-[11px] text-text-secondary">
            PUT /api/system/mapping · VERIFIED requires verified_by + verified_at + evidence_note
          </p>
        </div>

        {mapping.error ? (
          <Card>
            <p className="text-xs text-error">Failed to load mappings: {mapping.error}</p>
          </Card>
        ) : mapping.loading ? (
          <Card>
            <p className="text-xs text-text-secondary">Loading meter mappings…</p>
          </Card>
        ) : mapping.data && mapping.data.meters.length > 0 ? (
          <div className="space-y-3">
            {mapping.data.meters.map((meter) => (
              <MeterCard
                key={meter.id}
                meter={meter}
                onSaved={() => mapping.refresh()}
              />
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-xs text-text-secondary">
              No meters found. Ensure the DB migration has run and REAL meters are configured.
            </p>
          </Card>
        )}
      </section>
    </div>
  )
}
