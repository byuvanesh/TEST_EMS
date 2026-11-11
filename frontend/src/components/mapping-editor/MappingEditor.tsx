import { useState } from 'react'
import { Save, RefreshCw, CheckCircle2, AlertCircle, Link } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Card, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { apiClient } from '@/api/client'

const DECODE_TYPES = ['number', 'uint16', 'int16', 'uint32', 'int32', 'float32'] as const
const BYTE_ORDER_TYPES = ['BE', 'LE'] as const
const WORD_ORDER_TYPES = ['BE', 'LE'] as const

interface RawKeyInfo {
  key: string
  value: unknown
  type: string
}

interface MappingEditorForm {
  sourceKey: string
  decode: (typeof DECODE_TYPES)[number]
  wordOrder: (typeof WORD_ORDER_TYPES)[number]
  byteOrder: (typeof BYTE_ORDER_TYPES)[number]
  scale: string
  offset: string
  unit: string
  verificationStatus: 'UNVERIFIED' | 'VERIFIED'
  verifiedBy: string
  verifiedAt: string
  evidenceNote: string
  saving: boolean
  saveError: string | null
  saveOk: boolean
  previewValue: number | null
  previewError: string | null
  isPreviewing: boolean
}

interface MappingEditorProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  meterId: string
  meterLabel: string
  slaveId: number | null
  parameterKey: string
  parameterLabel: string
  parameterUnit: string
  rawKeys: RawKeyInfo[]
  existingMapping: {
    source_keys: string[]
    decode: string
    word_order: string
    byte_order: string
    scale: number
    offset: number
    unit: string
    verification_status: 'UNVERIFIED' | 'VERIFIED'
    verified_by: string | null
    verified_at: string | null
    evidence_note: string | null
  } | null
}

function derivationErrors(
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

export function MappingEditor({
  open,
  onClose,
  onSave,
  meterId,
  meterLabel,
  slaveId,
  parameterKey,
  parameterLabel,
  parameterUnit,
  rawKeys,
  existingMapping,
}: MappingEditorProps) {
  const [form, setForm] = useState<MappingEditorForm>({
    sourceKey: existingMapping?.source_keys?.[0] ?? '',
    decode: (existingMapping?.decode ?? 'number') as (typeof DECODE_TYPES)[number],
    wordOrder: (existingMapping?.word_order ?? 'BE') as (typeof WORD_ORDER_TYPES)[number],
    byteOrder: (existingMapping?.byte_order ?? 'BE') as (typeof BYTE_ORDER_TYPES)[number],
    scale: String(existingMapping?.scale ?? 1),
    offset: String(existingMapping?.offset ?? 0),
    unit: existingMapping?.unit ?? parameterUnit,
    verificationStatus: (existingMapping?.verification_status ?? 'UNVERIFIED') as 'UNVERIFIED' | 'VERIFIED',
    verifiedBy: existingMapping?.verified_by ?? '',
    verifiedAt: existingMapping?.verified_at ?? '',
    evidenceNote: existingMapping?.evidence_note ?? '',
    saving: false,
    saveError: null,
    saveOk: false,
    previewValue: null,
    previewError: null,
    isPreviewing: false,
  })

  const selectedRaw = rawKeys.find((k) => k.key === form.sourceKey)
  const rawValue = selectedRaw?.value

  const errors = derivationErrors(
    form.verificationStatus,
    form.verifiedBy,
    form.verifiedAt,
    form.evidenceNote,
  )

  const handleChange = (patch: Partial<MappingEditorForm>) => {
    setForm((prev) => ({
      ...prev,
      ...patch,
      saveOk: false,
      saveError: null,
    }))
  }

  const handlePreview = async () => {
    if (!form.sourceKey) {
      setForm((prev) => ({ ...prev, previewValue: null, previewError: 'No source key selected' }))
      return
    }
    setForm((prev) => ({ ...prev, isPreviewing: true, previewError: null }))

    try {
      const res = await apiClient.testSystemMapping({
        meter_id: meterId,
        mapping: {
          metric: parameterKey,
          source_keys: [form.sourceKey],
          decode: form.decode,
          word_order: form.wordOrder,
          byte_order: form.byteOrder,
          scale: Number(form.scale) || 1,
          offset: Number(form.offset) || 0,
          unit: form.unit,
          verification_status: 'UNVERIFIED',
        },
        raw_payload: undefined,
      })

      setForm((prev) => ({
        ...prev,
        isPreviewing: false,
        previewValue: res.decoded_value ?? null,
        previewError: res.decoded_value === null ? 'Decode returned NULL — check source key, decode type, and verification status' : null,
      }))
    } catch (err) {
      setForm((prev) => ({
        ...prev,
        isPreviewing: false,
        previewError: err instanceof Error ? err.message : 'Preview failed',
      }))
    }
  }

  const handleSave = async () => {
    const valErrors = derivationErrors(
      form.verificationStatus,
      form.verifiedBy,
      form.verifiedAt,
      form.evidenceNote,
    )
    if (valErrors.length > 0) {
      setForm((prev) => ({ ...prev, saveError: valErrors.join('; ') }))
      return
    }

    setForm((prev) => ({ ...prev, saving: true, saveError: null }))

    try {
      await apiClient.putSystemMapping({
        meter_id: meterId,
        mappings: [
          {
            metric: parameterKey,
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
      setForm((prev) => ({ ...prev, saving: false, saveOk: true }))
      onSave()
    } catch (err) {
      setForm((prev) => ({
        ...prev,
        saving: false,
        saveError: err instanceof Error ? err.message : 'Save failed',
      }))
    }
  }

  const engineeringValue = form.previewValue !== null
    ? (form.previewValue * Number(form.scale) + Number(form.offset)).toFixed(2)
    : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Map Parameter — ${parameterLabel}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setForm({
                sourceKey: existingMapping?.source_keys?.[0] ?? '',
                decode: (existingMapping?.decode ?? 'number') as (typeof DECODE_TYPES)[number],
                wordOrder: (existingMapping?.word_order ?? 'BE') as (typeof WORD_ORDER_TYPES)[number],
                byteOrder: (existingMapping?.byte_order ?? 'BE') as (typeof BYTE_ORDER_TYPES)[number],
                scale: String(existingMapping?.scale ?? 1),
                offset: String(existingMapping?.offset ?? 0),
                unit: existingMapping?.unit ?? parameterUnit,
                verificationStatus: (existingMapping?.verification_status ?? 'UNVERIFIED') as 'UNVERIFIED' | 'VERIFIED',
                verifiedBy: existingMapping?.verified_by ?? '',
                verifiedAt: existingMapping?.verified_at ?? '',
                evidenceNote: existingMapping?.evidence_note ?? '',
                saving: false,
                saveOk: false,
                saveError: null,
                previewValue: null,
                previewError: null,
                isPreviewing: false,
              })
            }}
            disabled={form.saving}
            className="rounded-[6px] border border-border px-3 py-1.5 text-xs text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.sourceKey || form.saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-accent px-3.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            {form.saving ? 'Saving…' : 'Save Mapping'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Card className="p-3">
          <CardHeader title="Parameter Identity" className="pb-2" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Parameter</p>
              <p className="font-medium text-text">{parameterLabel}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Slave ID</p>
              <p className="font-mono text-[10px] text-text">{slaveId ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Meter</p>
              <p className="font-mono text-[10px] text-text truncate">{meterLabel}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Metric Key</p>
              <p className="font-mono text-[10px] text-text">{parameterKey}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Unit</p>
              <p className="font-mono text-[10px] text-text">{parameterUnit}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <CardHeader title="JSON Source Key" className="pb-2" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Source Key</p>
              <select
                value={form.sourceKey}
                onChange={(e) => handleChange({ sourceKey: e.target.value })}
                className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] font-mono text-text outline-none focus:border-accent"
              >
                <option value="">— Select a key —</option>
                {rawKeys.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.key} ({k.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Raw Value</p>
              <div className="rounded-[4px] border border-border bg-surface p-2">
                <span className="font-mono text-[10px]">
                  {rawValue === null ? 'null' : typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue)}
                </span>
                <span className={`ml-1 text-[9px] ${rawValue === null ? 'text-amber-500' : rawValue === undefined ? 'text-text-secondary' : 'text-green-600'}`}>
                  [{typeof rawValue}]
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Available Keys</p>
              <div className="flex flex-wrap gap-1">
                {rawKeys.map((k) => (
                  <button
                    key={k.key}
                    onClick={() => handleChange({ sourceKey: k.key })}
                    className={cn(
                      'rounded-[4px] border px-1.5 py-0.5 text-[9px]',
                      form.sourceKey === k.key
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-border bg-surface text-text-secondary hover:border-text-secondary/50',
                    )}
                  >
                    {k.key}
                  </button>
                ))}
                {rawKeys.length === 0 && (
                  <span className="text-[9px] text-text-secondary italic">No keys available</span>
                )}
              </div>
            </div>
          </div>
          {form.previewError && (
            <div className="mt-2 rounded-[4px] border border-critical/30 bg-critical/10 p-2">
              <div className="flex items-start gap-1">
                <AlertCircle className="mt-0.5 h-3 w-3 text-critical shrink-0" />
                <p className="text-[9px] text-critical">{form.previewError}</p>
              </div>
            </div>
          )}
          {form.previewValue !== null && (
            <div className="mt-2 rounded-[4px] border border-success/30 bg-success/10 p-2">
              <div className="flex items-start gap-1">
                <CheckCircle2 className="mt-0.5 h-3 w-3 text-success shrink-0" />
                <p className="text-[9px] text-success">
                  Decoded value:{' '}
                  <span className="font-mono font-medium">{form.previewValue.toFixed(4)}</span>{' '}
                  × scale {form.scale} + offset {form.offset} ={' '}
                  <span className="font-bold">{engineeringValue} {form.unit}</span>
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handlePreview}
            disabled={form.isPreviewing || !form.sourceKey}
            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-border bg-card px-2.5 text-[10px] font-medium text-text hover:bg-surface disabled:opacity-50"
          >
            {form.isPreviewing ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Link className="h-3 w-3" />
            )}
            {form.isPreviewing ? 'Previewing…' : 'Test Decode'}
          </button>
        </Card>

        <Card className="p-3">
          <CardHeader title="Decoding Configuration" className="pb-2" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Decode Type</p>
              <select
                value={form.decode}
                onChange={(e) =>
                  handleChange({
                    decode: e.target.value as (typeof DECODE_TYPES)[number],
                  })
                }
                className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
              >
                {DECODE_TYPES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Word Order</p>
              <select
                value={form.wordOrder}
                onChange={(e) => handleChange({ wordOrder: e.target.value as (typeof WORD_ORDER_TYPES)[number] })}
                className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
              >
                {WORD_ORDER_TYPES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Byte Order</p>
              <select
                value={form.byteOrder}
                onChange={(e) => handleChange({ byteOrder: e.target.value as (typeof BYTE_ORDER_TYPES)[number] })}
                className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
              >
                {BYTE_ORDER_TYPES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mt-2">
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Scale</p>
              <input
                type="number"
                step="any"
                value={form.scale}
                onChange={(e) => handleChange({ scale: e.target.value })}
                className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
              />
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Offset</p>
              <input
                type="number"
                step="any"
                value={form.offset}
                onChange={(e) => handleChange({ offset: e.target.value })}
                className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
              />
            </div>
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Unit</p>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => handleChange({ unit: e.target.value })}
                className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
              />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <CardHeader title="Verification" className="pb-2" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-3">
            <div>
              <p className="text-[10px] font-medium text-text-secondary">Status</p>
              <select
                value={form.verificationStatus}
                onChange={(e) => handleChange({ verificationStatus: e.target.value as 'UNVERIFIED' | 'VERIFIED' })}
                className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
              >
                <option value="UNVERIFIED">UNVERIFIED</option>
                <option value="VERIFIED">VERIFIED</option>
              </select>
            </div>
            {form.verificationStatus === 'VERIFIED' && (
              <>
                <div>
                  <p className="text-[10px] font-medium text-text-secondary">Verified By</p>
                  <input
                    type="text"
                    value={form.verifiedBy}
                    onChange={(e) => handleChange({ verifiedBy: e.target.value })}
                    className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-text-secondary">Verified At</p>
                  <input
                    type="datetime-local"
                    value={form.verifiedAt}
                    onChange={(e) => handleChange({ verifiedAt: e.target.value })}
                    className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-text-secondary">Evidence Note</p>
                  <input
                    type="text"
                    value={form.evidenceNote}
                    onChange={(e) => handleChange({ evidenceNote: e.target.value })}
                    className="w-full rounded-[4px] border border-border bg-surface px-2 py-1.5 text-[10px] text-text outline-none focus:border-accent"
                  />
                </div>
              </>
            )}
          </div>
          {errors.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[10px] text-error" role="alert">
              {errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Drawer>
  )
}