import { useEffect, useReducer, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Radio,
  RefreshCw,
  Save,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'
import {
  apiClient,
  type ApiMappingItem,
  type ApiMeter,
  type ApiBridgeStatusResponse,
  type ApiSystemGatewayResponse,
  type ApiSystemMappingResponse,
  type ApiTestMappingResponse,
} from '@/api/client'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/cn'

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
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary">Meter</span>
          <select
            id="test-meter-id"
            value={form.meterId}
            onChange={(e) => set({ meterId: e.target.value })}
            className="h-9 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
          >
            {meters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} (slave {m.slave_id ?? '?'})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary">Metric name</span>
          <input
            id="test-metric"
            type="text"
            value={form.metric}
            onChange={(e) => set({ metric: e.target.value })}
            placeholder="active_power_kw"
            className="h-9 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary">Source keys (comma-sep)</span>
          <input
            id="test-source-keys"
            type="text"
            value={form.sourceKeys}
            onChange={(e) => set({ sourceKeys: e.target.value })}
            placeholder="reg_3000, reg_3001"
            className="h-9 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary">Decode type</span>
          <select
            id="test-decode"
            value={form.decode}
            onChange={(e) => set({ decode: e.target.value as DecodeType })}
            className="h-9 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
          >
            {DECODE_TYPES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary">Word order / Byte order</span>
          <div className="flex gap-2">
            <select
              id="test-word-order"
              value={form.wordOrder}
              onChange={(e) => set({ wordOrder: e.target.value as 'BE' | 'LE' })}
              className="h-9 flex-1 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
            >
              <option value="BE">Word: BE</option>
              <option value="LE">Word: LE</option>
            </select>
            <select
              id="test-byte-order"
              value={form.byteOrder}
              onChange={(e) => set({ byteOrder: e.target.value as 'BE' | 'LE' })}
              className="h-9 flex-1 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
            >
              <option value="BE">Byte: BE</option>
              <option value="LE">Byte: LE</option>
            </select>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-text-secondary">Scale / Offset / Unit</span>
          <div className="flex gap-2">
            <input
              id="test-scale"
              type="number"
              step="any"
              value={form.scale}
              onChange={(e) => set({ scale: e.target.value })}
              placeholder="1"
              className="h-9 w-20 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
            />
            <input
              id="test-offset"
              type="number"
              step="any"
              value={form.offset}
              onChange={(e) => set({ offset: e.target.value })}
              placeholder="0"
              className="h-9 w-20 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
            />
            <input
              id="test-unit"
              type="text"
              value={form.unit}
              onChange={(e) => set({ unit: e.target.value })}
              placeholder="kW"
              className="h-9 flex-1 rounded-[8px] border border-border bg-card px-2.5 text-sm text-text outline-none focus:border-accent"
            />
          </div>
        </label>
      </div>

      {error && (
        <p className="mt-3 text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          id="btn-run-mapping-test"
          type="button"
          onClick={handleTest}
          disabled={submitting}
          className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-accent px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FlaskConical className="h-4 w-4" />
          {submitting ? 'Running…' : 'Run test'}
        </button>
        <p className="text-[11px] text-text-secondary">
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
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface/60 transition-colors"
      >
        <span className="text-text-secondary transition-transform">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="font-mono text-xs text-text flex-1">{mapping.metric}</span>
        <span className="font-mono text-[11px] text-text-secondary">
          [{mapping.source_keys.join(', ')}]
        </span>
        <span className="ml-2 text-[11px] text-text-secondary">{mapping.decode}</span>
        <span
          className={cn(
            'ml-3 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase',
            mapping.verification_status === 'VERIFIED'
              ? 'border border-success/30 bg-success/10 text-success'
              : 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
          )}
        >
          {mapping.verification_status}
        </span>
        {s.saveOk && (
          <CheckCircle2 className="ml-2 h-3.5 w-3.5 text-success" />
        )}
        <span className="ml-2 text-[11px] text-text-secondary">v{mapping.version}</span>
      </button>

      {/* Expanded edit form */}
      {expanded && (
        <div className="border-t border-border bg-surface/40 px-4 py-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-secondary">Source keys</span>
              <input
                type="text"
                value={s.source_keys}
                onChange={(e) => patch({ source_keys: e.target.value })}
                className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent font-mono"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-secondary">Decode type</span>
              <select
                value={s.decode}
                onChange={(e) => patch({ decode: e.target.value as ApiMappingItem['decode'] })}
                className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
              >
                {DECODE_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[11px] font-medium text-text-secondary">Word order</span>
                <select
                  value={s.word_order}
                  onChange={(e) => patch({ word_order: e.target.value as 'BE' | 'LE' })}
                  className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                >
                  <option value="BE">BE</option>
                  <option value="LE">LE</option>
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[11px] font-medium text-text-secondary">Byte order</span>
                <select
                  value={s.byte_order}
                  onChange={(e) => patch({ byte_order: e.target.value as 'BE' | 'LE' })}
                  className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                >
                  <option value="BE">BE</option>
                  <option value="LE">LE</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-secondary">Scale</span>
              <input
                type="number"
                step="any"
                value={s.scale}
                onChange={(e) => patch({ scale: e.target.value })}
                className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-secondary">Offset</span>
              <input
                type="number"
                step="any"
                value={s.offset}
                onChange={(e) => patch({ offset: e.target.value })}
                className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-text-secondary">Unit</span>
              <input
                type="text"
                value={s.unit}
                onChange={(e) => patch({ unit: e.target.value })}
                className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
              />
            </label>
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
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-text-secondary">
                    Verified by <span className="text-error">*</span>
                  </span>
                  <input
                    id={`verified-by-${mapping.id}`}
                    type="text"
                    value={s.verified_by}
                    onChange={(e) => patch({ verified_by: e.target.value })}
                    placeholder="engineer name"
                    className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-text-secondary">
                    Verified at <span className="text-error">*</span>
                  </span>
                  <input
                    id={`verified-at-${mapping.id}`}
                    type="datetime-local"
                    value={s.verified_at}
                    onChange={(e) => patch({ verified_at: e.target.value })}
                    className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 sm:col-span-1">
                  <span className="text-[11px] font-medium text-text-secondary">
                    Evidence note <span className="text-error">*</span>
                  </span>
                  <input
                    id={`evidence-note-${mapping.id}`}
                    type="text"
                    value={s.evidence_note}
                    onChange={(e) => patch({ evidence_note: e.target.value })}
                    placeholder="bench test result / meter display match"
                    className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs text-text outline-none focus:border-accent"
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-accent px-3 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
              <span className="flex items-center gap-1 text-xs text-success">
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
        className="flex w-full items-center gap-3 px-5 py-4 hover:bg-surface/60 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">
            {meter.label}
          </p>
          <p className="text-[11px] text-text-secondary">
            Slave ID: {meter.slave_id ?? '?'} · Model: {meter.model ?? 'unknown'} ·
            Gateway: {meter.gateway?.code ?? '—'} (MAC: {meter.gateway?.mac ?? '—'})
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-secondary">
          <span className="text-success font-medium">{verifiedCount} VERIFIED</span>
          <span>/</span>
          <span>{meter.mappings.length} metrics</span>
          {!meter.modbus_variant_verified && (
            <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" /> Modbus unverified
            </span>
          )}
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
        <p className="border-t border-border px-5 py-4 text-xs text-text-secondary">
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
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <p className="text-text-secondary">Status</p>
          <p className={cn('mt-0.5 font-semibold capitalize', bridgeStatusColor(bridge.status))}>
            {bridge.status}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">Mode</p>
          <p className="mt-0.5 font-medium text-text capitalize">{bridge.mode}</p>
        </div>
        <div>
          <p className="text-text-secondary">Last receive</p>
          <p className="mt-0.5 font-mono font-medium text-text">
            {bridge.last_receive_time
              ? formatTimestamp(bridge.last_receive_time)
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">WS frames</p>
          <p className="tabular mt-0.5 font-medium text-text">{m.wsFramesTotal}</p>
        </div>
        <div>
          <p className="text-text-secondary">Polls OK / Total</p>
          <p className="tabular mt-0.5 font-medium text-text">
            {m.pollsOk} / {m.pollsTotal}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">Poll errors</p>
          <p
            className={cn(
              'tabular mt-0.5 font-medium',
              m.pollsError > 0 ? 'text-error' : 'text-text',
            )}
          >
            {m.pollsError}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">Archive inserts</p>
          <p className="tabular mt-0.5 font-medium text-text">{m.archiveInserts}</p>
        </div>
        <div>
          <p className="text-text-secondary">Decode errors</p>
          <p
            className={cn(
              'tabular mt-0.5 font-medium',
              m.decodeErrors > 0 ? 'text-error' : 'text-text',
            )}
          >
            {m.decodeErrors}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">Auth errors</p>
          <p
            className={cn(
              'tabular mt-0.5 font-medium',
              m.authErrors > 0 ? 'text-error' : 'text-text',
            )}
          >
            {m.authErrors}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">TS reversals</p>
          <p
            className={cn(
              'tabular mt-0.5 font-medium',
              m.tsReversals > 0 ? 'text-amber-500' : 'text-text',
            )}
          >
            {m.tsReversals}
          </p>
        </div>
        <div>
          <p className="text-text-secondary">Duplicates</p>
          <p className="tabular mt-0.5 font-medium text-text">{m.archiveDuplicates}</p>
        </div>
        <div>
          <p className="text-text-secondary">Oversized drops</p>
          <p
            className={cn(
              'tabular mt-0.5 font-medium',
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
      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <p className="text-text-secondary">Code</p>
          <p className="mt-0.5 font-medium text-text font-mono">{gw.gateway.code}</p>
        </div>
        <div>
          <p className="text-text-secondary">MAC</p>
          <p className="mt-0.5 font-mono text-text text-[11px]">{gw.gateway.mac}</p>
        </div>
        <div>
          <p className="text-text-secondary">Firmware</p>
          <p className="mt-0.5 font-medium text-text">{gw.gateway.firmware_version ?? '—'}</p>
        </div>
        <div>
          <p className="text-text-secondary">RS-485 master verified</p>
          <p
            className={cn(
              'mt-0.5 font-semibold',
              gw.gateway.rs485_master_verified ? 'text-success' : 'text-amber-500',
            )}
          >
            {gw.gateway.rs485_master_verified ? 'Yes' : 'No'}
          </p>
        </div>
      </div>

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        Meter states (gateway-level only)
      </p>
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
      <p className="mt-2 text-[11px] text-text-secondary">
        {gw.meters[0]?.note}
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

  const reload = () => {
    mapping.refresh()
    gateway.refresh()
    bridge.refresh()
  }

  const overallLoading = mapping.loading || gateway.loading || bridge.loading

  return (
    <div className="space-y-5">
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
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-border bg-card px-3 text-xs text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="mb-3 flex items-center justify-between">
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
