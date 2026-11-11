import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileImage,
  Loader2,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useBranding } from '@/context/BrandingContext'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/cn'

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024 // 3 MB
const MIN_DIMENSION = 16
const MAX_DIMENSION = 4096

function validateClientHttpsUrl(input: string): { valid: boolean; error?: string } {
  const trimmed = input.trim()
  if (!trimmed) {
    return { valid: false, error: 'Destination URL cannot be empty.' }
  }
  if (trimmed.length > 512) {
    return { valid: false, error: 'Destination URL cannot exceed 512 characters.' }
  }
  if (!trimmed.startsWith('https://')) {
    return { valid: false, error: 'Only HTTPS URLs are allowed (must begin with https://).' }
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Protocol must be strictly https:.' }
    }
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'URLs with embedded credentials are not allowed.' }
    }
    if (!parsed.hostname || parsed.hostname.includes(' ')) {
      return { valid: false, error: 'Invalid hostname in destination URL.' }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Malformed or invalid destination URL.' }
  }
}

export function SettingsPage() {
  const { user } = useAuth()
  const {
    companyName: serverCompanyName,
    logoUrl: serverLogoUrl,
    showAttribution: serverShowAttribution,
    attributionText: serverAttributionText,
    websiteLinkEnabled: serverWebsiteLinkEnabled,
    websiteLinkText: serverWebsiteLinkText,
    websiteLinkUrl: serverWebsiteLinkUrl,
    faviconUrl: serverFaviconUrl,
    updateBranding,
    resetBranding,
  } = useBranding()

  // Form Staged State
  const [stagedCompanyName, setStagedCompanyName] = useState<string>(serverCompanyName)
  const [stagedLogoDataUrl, setStagedLogoDataUrl] = useState<string | null | undefined>(undefined)
  const [stagedFileName, setStagedFileName] = useState<string | null>(null)
  const [stagedFileSize, setStagedFileSize] = useState<number | null>(null)
  const [stagedDimensions, setStagedDimensions] = useState<{ width: number; height: number } | null>(null)
  const [stagedShowAttribution, setStagedShowAttribution] = useState<boolean>(serverShowAttribution)
  const [stagedAttributionText, setStagedAttributionText] = useState<string>(serverAttributionText)
  const [stagedWebsiteLinkEnabled, setStagedWebsiteLinkEnabled] = useState<boolean>(serverWebsiteLinkEnabled)
  const [stagedWebsiteLinkText, setStagedWebsiteLinkText] = useState<string>(serverWebsiteLinkText)
  const [stagedWebsiteLinkUrl, setStagedWebsiteLinkUrl] = useState<string>(serverWebsiteLinkUrl)

  // Favicon Staged State
  const [stagedFaviconDataUrl, setStagedFaviconDataUrl] = useState<string | null | undefined>(undefined)
  const [stagedFaviconFileName, setStagedFaviconFileName] = useState<string | null>(null)
  const [stagedFaviconFileSize, setStagedFaviconFileSize] = useState<number | null>(null)
  const [stagedFaviconDimensions, setStagedFaviconDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isFaviconDragging, setIsFaviconDragging] = useState(false)

  // Feedback & UI State
  const [validationError, setValidationError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const faviconFileInputRef = useRef<HTMLInputElement>(null)

  // Sync initial state when server branding loads
  useEffect(() => {
    if (stagedLogoDataUrl === undefined) {
      setStagedCompanyName(serverCompanyName)
    }
  }, [serverCompanyName, stagedLogoDataUrl])

  useEffect(() => {
    setStagedShowAttribution(serverShowAttribution)
    setStagedAttributionText(serverAttributionText)
  }, [serverShowAttribution, serverAttributionText])

  useEffect(() => {
    setStagedWebsiteLinkEnabled(serverWebsiteLinkEnabled)
    setStagedWebsiteLinkText(serverWebsiteLinkText)
    setStagedWebsiteLinkUrl(serverWebsiteLinkUrl)
  }, [serverWebsiteLinkEnabled, serverWebsiteLinkText, serverWebsiteLinkUrl])

  // Computed active logo URL for preview
  const activeLogoUrl =
    stagedLogoDataUrl !== undefined ? stagedLogoDataUrl : serverLogoUrl

  // Computed active favicon URL for preview
  const activeFaviconUrl =
    stagedFaviconDataUrl !== undefined ? stagedFaviconDataUrl : serverFaviconUrl

  // Computed dirty state
  const isNameDirty = stagedCompanyName.trim() !== serverCompanyName
  const isLogoDirty = stagedLogoDataUrl !== undefined
  const isFaviconDirty = stagedFaviconDataUrl !== undefined
  const isAttributionDirty =
    stagedShowAttribution !== serverShowAttribution ||
    stagedAttributionText.trim() !== serverAttributionText
  const isWebsiteLinkDirty =
    stagedWebsiteLinkEnabled !== serverWebsiteLinkEnabled ||
    stagedWebsiteLinkText.trim() !== serverWebsiteLinkText ||
    stagedWebsiteLinkUrl.trim() !== serverWebsiteLinkUrl

  const isDirty = isNameDirty || isLogoDirty || isFaviconDirty || isAttributionDirty || isWebsiteLinkDirty

  const isNameValid =
    stagedCompanyName.trim().length >= 1 && stagedCompanyName.length <= 128
  const isAttributionValid =
    !stagedShowAttribution ||
    (stagedAttributionText.trim().length >= 1 && stagedAttributionText.length <= 64)
  const isWebsiteLinkValid =
    !stagedWebsiteLinkEnabled ||
    (stagedWebsiteLinkText.trim().length >= 1 &&
      stagedWebsiteLinkText.length <= 64 &&
      validateClientHttpsUrl(stagedWebsiteLinkUrl).valid)

  const canSave =
    isDirty &&
    isNameValid &&
    isAttributionValid &&
    isWebsiteLinkValid &&
    !validationError &&
    !isSaving &&
    !isResetting

  // --------------------------------------------------------------------------
  // Authorization Gate — Server-authoritative check (req.user.role === 'admin')
  // --------------------------------------------------------------------------
  if (user?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-2xl py-12 px-4 sm:px-6">
        <Card padding="md" className="border-critical/30 bg-critical/5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-critical/10 text-critical">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-text">Access Restricted</h2>
          <p className="mt-1.5 text-xs text-text-secondary leading-relaxed max-w-md mx-auto">
            Administrator privileges are required to configure organizational identity and company
            branding settings. Please contact your system administrator.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-[6px] bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent/90 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Dashboard
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // Image File Validation & Decoding Helper
  // --------------------------------------------------------------------------
  const processImageFile = (file: File) => {
    setValidationError(null)
    setServerError(null)
    setSuccessMessage(null)

    // 1. Strict SVG Rejection by extension and mime
    const isSvg =
      file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
    if (isSvg) {
      setValidationError(
        'SVG files are strictly disallowed due to enterprise security policies. Please upload a PNG, JPEG, or WebP image.',
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 2. Strict Supported MIME types
    const validMimes = ['image/png', 'image/jpeg', 'image/webp']
    if (!validMimes.includes(file.type)) {
      setValidationError(
        'Unsupported image format. Only PNG, JPEG, and WebP assets are accepted.',
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 3. Strict 3 MB File Size Limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2)
      setValidationError(
        `File size (${sizeMb} MB) exceeds the maximum allowed 3 MB (3,145,728 bytes) ceiling.`,
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 4. Client-side Image Decoding & Dimension Verification
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) {
        setValidationError('Failed to read image asset.')
        return
      }

      const img = new Image()
      img.onload = () => {
        const { naturalWidth: width, naturalHeight: height } = img

        if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
          setValidationError(
            `Image dimensions (${width}×${height} px) are smaller than the minimum ${MIN_DIMENSION}×${MIN_DIMENSION} px requirement.`,
          )
          return
        }

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          setValidationError(
            `Image dimensions (${width}×${height} px) exceed the maximum ${MAX_DIMENSION}×${MAX_DIMENSION} px limit.`,
          )
          return
        }

        // Staging successful
        setStagedLogoDataUrl(dataUrl)
        setStagedFileName(file.name)
        setStagedFileSize(file.size)
        setStagedDimensions({ width, height })
      }

      img.onerror = () => {
        setValidationError('Corrupted or undecodable image file.')
      }

      img.src = dataUrl
    }

    reader.onerror = () => {
      setValidationError('Failed to read selected image file.')
    }

    reader.readAsDataURL(file)
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  // --------------------------------------------------------------------------
  // Favicon File Validation & Client-Side Image Loading Helper
  // --------------------------------------------------------------------------
  const processFaviconFile = (file: File) => {
    setValidationError(null)
    setServerError(null)
    setSuccessMessage(null)

    // 1. Strict SVG Rejection
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
    if (isSvg) {
      setValidationError(
        'SVG files are disallowed for custom favicon uploads. Please upload a PNG, JPEG, or WebP image.',
      )
      if (faviconFileInputRef.current) faviconFileInputRef.current.value = ''
      return
    }

    // 2. Strict Supported MIME types
    const validMimes = ['image/png', 'image/jpeg', 'image/webp']
    if (!validMimes.includes(file.type)) {
      setValidationError(
        'Unsupported favicon format. Only PNG, JPEG, and WebP assets are accepted.',
      )
      if (faviconFileInputRef.current) faviconFileInputRef.current.value = ''
      return
    }

    // 3. Strict 3 MB File Size Limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2)
      setValidationError(
        `Favicon file size (${sizeMb} MB) exceeds the maximum allowed 3 MB ceiling.`,
      )
      if (faviconFileInputRef.current) faviconFileInputRef.current.value = ''
      return
    }

    // 4. Client-side Image Decoding & Dimension Verification
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) {
        setValidationError('Failed to read favicon asset.')
        return
      }

      const img = new Image()
      img.onload = () => {
        const { naturalWidth: width, naturalHeight: height } = img

        if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
          setValidationError(
            `Favicon dimensions (${width}×${height} px) are below the minimum ${MIN_DIMENSION}×${MIN_DIMENSION} px requirement.`,
          )
          return
        }

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          setValidationError(
            `Favicon dimensions (${width}×${height} px) exceed the maximum ${MAX_DIMENSION}×${MAX_DIMENSION} px limit.`,
          )
          return
        }

        // Staging successful
        setStagedFaviconDataUrl(dataUrl)
        setStagedFaviconFileName(file.name)
        setStagedFaviconFileSize(file.size)
        setStagedFaviconDimensions({ width, height })
      }

      img.onerror = () => {
        setValidationError('Corrupted or undecodable favicon image file.')
      }

      img.src = dataUrl
    }

    reader.onerror = () => {
      setValidationError('Failed to read selected favicon file.')
    }

    reader.readAsDataURL(file)
  }

  const handleFaviconFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFaviconFile(file)
    }
  }

  const handleFaviconDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsFaviconDragging(true)
  }

  const handleFaviconDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsFaviconDragging(false)
  }

  const handleFaviconDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsFaviconDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFaviconFile(file)
    }
  }

  // Stage removal of current/staged logo
  const handleRemoveLogo = () => {
    setStagedLogoDataUrl(null)
    setStagedFileName(null)
    setStagedFileSize(null)
    setStagedDimensions(null)
    setValidationError(null)
    setServerError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Stage removal of custom favicon (restore default TEST_EMS icon)
  const handleRemoveFavicon = () => {
    setStagedFaviconDataUrl(null)
    setStagedFaviconFileName(null)
    setStagedFaviconFileSize(null)
    setStagedFaviconDimensions(null)
    setValidationError(null)
    setServerError(null)
    if (faviconFileInputRef.current) faviconFileInputRef.current.value = ''
  }

  // Cancel only staged favicon upload before saving
  const handleCancelStagedFavicon = () => {
    setStagedFaviconDataUrl(undefined)
    setStagedFaviconFileName(null)
    setStagedFaviconFileSize(null)
    setStagedFaviconDimensions(null)
    setValidationError(null)
    setServerError(null)
    if (faviconFileInputRef.current) faviconFileInputRef.current.value = ''
  }

  // Discard all unsaved staged changes
  const handleDiscardChanges = () => {
    setStagedCompanyName(serverCompanyName)
    setStagedLogoDataUrl(undefined)
    setStagedFileName(null)
    setStagedFileSize(null)
    setStagedDimensions(null)
    setStagedFaviconDataUrl(undefined)
    setStagedFaviconFileName(null)
    setStagedFaviconFileSize(null)
    setStagedFaviconDimensions(null)
    setStagedShowAttribution(serverShowAttribution)
    setStagedAttributionText(serverAttributionText)
    setStagedWebsiteLinkEnabled(serverWebsiteLinkEnabled)
    setStagedWebsiteLinkText(serverWebsiteLinkText)
    setStagedWebsiteLinkUrl(serverWebsiteLinkUrl)
    setValidationError(null)
    setServerError(null)
    setSuccessMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (faviconFileInputRef.current) faviconFileInputRef.current.value = ''
  }

  // Restore attribution defaults to "Powered by ELLCRAFTS"
  const handleRestoreDefaultAttribution = () => {
    setStagedShowAttribution(true)
    setStagedAttributionText('ELLCRAFTS')
    setValidationError(null)
    setServerError(null)
  }

  // Restore website link defaults to "www.ellcrafts.com" / "https://www.ellcrafts.com"
  const handleRestoreDefaultWebsiteLink = () => {
    setStagedWebsiteLinkEnabled(true)
    setStagedWebsiteLinkText('www.ellcrafts.com')
    setStagedWebsiteLinkUrl('https://www.ellcrafts.com')
    setValidationError(null)
    setServerError(null)
  }

  // Save changes via PUT /api/system/branding
  const handleSaveChanges = async () => {
    if (!canSave) return

    setIsSaving(true)
    setServerError(null)
    setSuccessMessage(null)

    const payload: {
      company_name?: string
      logo_base64?: string | null
      show_attribution?: boolean
      attribution_text?: string
      website_link_enabled?: boolean
      website_link_text?: string
      website_link_url?: string
      favicon_base64?: string | null
    } = {}
    if (isNameDirty) {
      payload.company_name = stagedCompanyName.trim()
    }
    if (isLogoDirty) {
      payload.logo_base64 = stagedLogoDataUrl
    }
    if (isFaviconDirty) {
      payload.favicon_base64 = stagedFaviconDataUrl
    }
    if (stagedShowAttribution !== serverShowAttribution) {
      payload.show_attribution = stagedShowAttribution
    }
    if (stagedAttributionText.trim() !== serverAttributionText) {
      payload.attribution_text = stagedAttributionText.trim()
    }
    if (stagedWebsiteLinkEnabled !== serverWebsiteLinkEnabled) {
      payload.website_link_enabled = stagedWebsiteLinkEnabled
    }
    if (stagedWebsiteLinkText.trim() !== serverWebsiteLinkText) {
      payload.website_link_text = stagedWebsiteLinkText.trim()
    }
    if (stagedWebsiteLinkUrl.trim() !== serverWebsiteLinkUrl) {
      payload.website_link_url = stagedWebsiteLinkUrl.trim()
    }

    const res = await updateBranding(payload)
    setIsSaving(false)

    if (res.ok && res.branding) {
      setSuccessMessage('Company branding and browser tab icon saved successfully.')
      setStagedCompanyName(res.branding.company_name)
      setStagedLogoDataUrl(undefined)
      setStagedFileName(null)
      setStagedFileSize(null)
      setStagedDimensions(null)
      setStagedFaviconDataUrl(undefined)
      setStagedFaviconFileName(null)
      setStagedFaviconFileSize(null)
      setStagedFaviconDimensions(null)
      setStagedShowAttribution(res.branding.show_attribution)
      setStagedAttributionText(res.branding.attribution_text)
      setStagedWebsiteLinkEnabled(res.branding.website_link_enabled)
      setStagedWebsiteLinkText(res.branding.website_link_text)
      setStagedWebsiteLinkUrl(res.branding.website_link_url)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (faviconFileInputRef.current) faviconFileInputRef.current.value = ''
    } else {
      setServerError(res.error || 'Failed to save branding changes.')
    }
  }

  // Restore factory defaults via POST /api/system/branding/reset
  const handleConfirmReset = async () => {
    setIsResetting(true)
    setServerError(null)
    setSuccessMessage(null)

    const res = await resetBranding()
    setIsResetting(false)
    setShowResetConfirm(false)

    if (res.ok && res.branding) {
      setSuccessMessage('Default TEST_EMS branding and favicon restored.')
      setStagedCompanyName(res.branding.company_name)
      setStagedLogoDataUrl(undefined)
      setStagedFileName(null)
      setStagedFileSize(null)
      setStagedDimensions(null)
      setStagedFaviconDataUrl(undefined)
      setStagedFaviconFileName(null)
      setStagedFaviconFileSize(null)
      setStagedFaviconDimensions(null)
      setStagedShowAttribution(res.branding.show_attribution)
      setStagedAttributionText(res.branding.attribution_text)
      setStagedWebsiteLinkEnabled(res.branding.website_link_enabled)
      setStagedWebsiteLinkText(res.branding.website_link_text)
      setStagedWebsiteLinkUrl(res.branding.website_link_url)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (faviconFileInputRef.current) faviconFileInputRef.current.value = ''
    } else {
      setServerError(res.error || 'Failed to restore branding defaults.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Breadcrumb & Page Header */}
      <PageHeader
        breadcrumbs={
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Link to="/system" className="hover:text-text transition-colors">
              System
            </Link>
            <span>/</span>
            <span className="text-text font-medium">Branding Settings</span>
          </div>
        }
        title="Company Branding"
        description="Customize organization identity, brand logos, and application styling across dashboard navigation, login portals, and exported reports."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              disabled={isSaving || isResetting}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface hover:text-critical transition-colors shadow-xs disabled:opacity-50"
              title="Restore TEST_EMS defaults"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Restore Defaults</span>
            </button>
          </div>
        }
      />

      {/* Notifications / Alerts */}
      {successMessage ? (
        <div className="flex items-center gap-2 rounded-[8px] border border-success/30 bg-success/10 p-3.5 text-xs font-medium text-success animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {serverError ? (
        <div className="flex items-start gap-2 rounded-[8px] border border-critical/30 bg-critical/10 p-3.5 text-xs font-medium text-critical animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      ) : null}

      {validationError ? (
        <div className="flex items-start gap-2 rounded-[8px] border border-warning/40 bg-amber-50 p-3.5 text-xs font-medium text-amber-800 animate-in fade-in duration-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <span>{validationError}</span>
        </div>
      ) : null}

      {/* Form Cards (Inspo Direction 1 — Minimalist Enterprise Single-Column) */}
      <div className="space-y-6">
        {/* Card 1: Organization Identity */}
        <Card padding="md">
          <CardHeader
            title="Organization Identity"
            subtitle="The company name displayed across navigation headers, authentication screens, and exported reports."
          />
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="company-name-input"
                  className="block text-xs font-semibold text-text"
                >
                  Company Name <span className="text-critical">*</span>
                </label>
                <span
                  className={cn(
                    'text-[11px] tabular',
                    stagedCompanyName.length > 128
                      ? 'font-bold text-critical'
                      : 'text-text-secondary',
                  )}
                >
                  {stagedCompanyName.length} / 128
                </span>
              </div>
              <div className="mt-1.5 relative">
                <input
                  id="company-name-input"
                  type="text"
                  maxLength={128}
                  value={stagedCompanyName}
                  onChange={(e) => {
                    setStagedCompanyName(e.target.value)
                    setValidationError(null)
                    setServerError(null)
                  }}
                  placeholder="e.g. Acme Industrial"
                  className="h-10 w-full rounded-[6px] border border-border bg-card px-3 text-xs text-text placeholder:text-text-secondary/60 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-text-secondary">
                Must be between 1 and 128 characters. Whitespace-only values are disallowed.
              </p>
            </div>
          </div>
        </Card>

        {/* Card 2: Brand Logo Asset */}
        <Card padding="md">
          <CardHeader
            title="Brand Logo Asset"
            subtitle="Upload a square or rectangular brand logo. PNG, JPEG, and WebP are supported up to 3 MB."
          />

          {/* Compliance & Policy Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-surface px-2 py-0.5 text-[11px] font-medium text-text-secondary border border-border">
              PNG, JPEG, WebP
            </span>
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-surface px-2 py-0.5 text-[11px] font-medium text-text-secondary border border-border">
              Max 3 MB
            </span>
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-surface px-2 py-0.5 text-[11px] font-medium text-text-secondary border border-border">
              16×16 to 4096×4096 px
            </span>
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-critical/10 text-critical border border-critical/20 px-2 py-0.5 text-[11px] font-medium">
              SVG Prohibited
            </span>
          </div>

          <div className="space-y-4">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
              aria-label="Upload company logo"
            />

            {/* Current / Staged Logo Display or Dropzone */}
            {activeLogoUrl ? (
              <div className="rounded-[8px] border border-border bg-surface/50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* Checkerboard transparency container for logo tile */}
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[8px] border border-border bg-white p-2 shadow-xs overflow-hidden">
                      <div
                        className="absolute inset-0 opacity-15"
                        style={{
                          backgroundImage:
                            'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
                          backgroundSize: '12px 12px',
                          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                        }}
                      />
                      <img
                        src={activeLogoUrl}
                        alt="Company Logo Preview"
                        className="relative z-10 max-h-full max-w-full object-contain"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text flex items-center gap-1.5">
                        <FileImage className="h-3.5 w-3.5 text-accent" />
                        {stagedFileName || 'Custom Brand Logo'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                        {stagedDimensions ? (
                          <span>{stagedDimensions.width} × {stagedDimensions.height} px</span>
                        ) : (
                          <span>Active Logo</span>
                        )}
                        {stagedFileSize ? (
                          <>
                            <span>•</span>
                            <span>{(stagedFileSize / 1024).toFixed(1)} KB</span>
                          </>
                        ) : null}
                        {stagedLogoDataUrl !== undefined && stagedLogoDataUrl !== null ? (
                          <span className="rounded bg-accent/10 px-1.5 py-0.5 font-medium text-accent">
                            Staged (Unsaved)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions on existing logo */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface transition-colors shadow-xs"
                    >
                      <UploadCloud className="h-3.5 w-3.5 text-text-secondary" />
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1.5 rounded-[6px] border border-critical/30 bg-card px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/10 transition-colors shadow-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Drag & Drop Zone */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-[8px] border-2 border-dashed p-8 text-center transition-all',
                  isDragging
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-text-secondary/50 bg-surface/30',
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-text-secondary">
                  <UploadCloud className="h-6 w-6 text-accent" />
                </div>
                <p className="mt-3 text-xs font-medium text-text">
                  Drag & drop your company logo here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-semibold text-accent hover:underline focus:outline-none"
                  >
                    browse files
                  </button>
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  Supported formats: PNG, JPEG, WebP up to 3 MB (16×16 to 4096×4096 px)
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Card 3: Browser Tab Icon (Favicon) */}
        <Card padding="md" data-testid="settings-favicon-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <CardHeader
              title="Browser Tab Icon (Favicon)"
              subtitle="Upload and manage the custom company icon displayed in browser tabs, bookmarks, and shortcuts."
            />
            <div className="flex items-center gap-2">
              {activeFaviconUrl ? (
                <button
                  type="button"
                  onClick={handleRemoveFavicon}
                  disabled={isSaving || isResetting}
                  className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-[6px] border border-border bg-card px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface hover:text-critical transition-colors shadow-xs"
                  title="Remove custom favicon and restore default TEST_EMS icon"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Restore Default Icon</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={faviconFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFaviconFileInputChange}
            className="hidden"
            data-testid="favicon-file-input"
          />

          <div className="space-y-4">
            {/* Status & Active Icon Info */}
            <div className="flex items-center justify-between rounded-[8px] border border-border bg-surface/40 p-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-[6px] border border-border bg-card flex items-center justify-center p-1 shadow-xs">
                  {activeFaviconUrl ? (
                    <img
                      src={activeFaviconUrl}
                      alt="Active Favicon"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-[6px] bg-[#2563EB] flex items-center justify-center text-white">
                      <Activity className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text">
                      {activeFaviconUrl ? 'Custom Favicon Active' : 'Default TEST_EMS Icon'}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide',
                        activeFaviconUrl
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                      )}
                    >
                      {activeFaviconUrl ? 'CUSTOM' : 'DEFAULT'}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    {stagedFaviconDataUrl !== undefined && stagedFaviconDataUrl !== null
                      ? `Staged: ${stagedFaviconFileName || 'New icon'} (${((stagedFaviconFileSize || 0) / 1024).toFixed(1)} KB) — Unsaved`
                      : activeFaviconUrl
                        ? 'Serving custom square favicon (128×128 PNG) with versioned SHA-256 caching'
                        : 'Default industrial activity pulse icon (/favicon.svg)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Area / Staged Preview */}
            {stagedFaviconDataUrl !== undefined && stagedFaviconDataUrl !== null ? (
              <div className="rounded-[8px] border border-accent/40 bg-accent/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-[6px] border border-border bg-card p-1 shrink-0 flex items-center justify-center shadow-xs">
                    <img
                      src={stagedFaviconDataUrl}
                      alt="Staged Favicon"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text truncate max-w-[200px]">
                        {stagedFaviconFileName || 'Uploaded Favicon'}
                      </span>
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                        STAGED (UNSAVED)
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      {stagedFaviconDimensions
                        ? `${stagedFaviconDimensions.width}×${stagedFaviconDimensions.height} px`
                        : ''}
                      {stagedFaviconFileSize
                        ? ` · ${(stagedFaviconFileSize / 1024).toFixed(1)} KB`
                        : ''}
                      {' · Processed to 128×128 square PNG with transparent containment'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => faviconFileInputRef.current?.click()}
                    className="rounded-[6px] border border-border bg-card px-2.5 py-1 text-xs font-medium text-text hover:bg-surface transition-colors shadow-xs"
                  >
                    Replace File
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelStagedFavicon}
                    className="rounded-[6px] border border-border bg-card px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-critical hover:bg-surface transition-colors shadow-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleFaviconDragOver}
                onDragLeave={handleFaviconDragLeave}
                onDrop={handleFaviconDrop}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-[8px] border-2 border-dashed p-6 text-center transition-all',
                  isFaviconDragging
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-text-secondary/50 bg-surface/30',
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text-secondary">
                  <UploadCloud className="h-5 w-5 text-accent" />
                </div>
                <p className="mt-2 text-xs font-medium text-text">
                  Drag & drop your favicon icon here, or{' '}
                  <button
                    type="button"
                    onClick={() => faviconFileInputRef.current?.click()}
                    className="font-semibold text-accent hover:underline focus:outline-none"
                  >
                    browse files
                  </button>
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  PNG, JPEG, WebP up to 3 MB · 1:1 square recommended (16×16 to 4096×4096 px)
                </p>
              </div>
            )}

            {/* Realistic Previews (Inspo Direction: Realistic Tab + Multi-Resolution Matrix) */}
            <div className="pt-2 space-y-4">
              {/* Simulated Browser Tab */}
              <div>
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                  Simulated Browser Tab Preview
                </span>
                <div className="rounded-[8px] border border-border bg-slate-100 dark:bg-slate-900/60 p-3 shadow-xs">
                  {/* Browser Tab Shell */}
                  <div className="rounded-t-[8px] bg-slate-200/80 dark:bg-slate-800/80 pt-2 px-3 border-b border-border/40">
                    <div className="inline-flex items-center gap-2 max-w-[280px] sm:max-w-[340px] rounded-t-[6px] bg-card px-3 py-1.5 shadow-xs border-t border-x border-border/30">
                      {activeFaviconUrl ? (
                        <img
                          src={activeFaviconUrl}
                          alt="Favicon"
                          className="h-4 w-4 shrink-0 rounded-[2px] object-contain"
                        />
                      ) : (
                        <div className="h-4 w-4 shrink-0 rounded-[3px] bg-[#2563EB] flex items-center justify-center text-white">
                          <Activity className="h-2.5 w-2.5" />
                        </div>
                      )}
                      <span className="truncate text-xs font-medium text-text">
                        {stagedCompanyName.trim() || serverCompanyName || 'TEST_EMS'} — Energy Management
                      </span>
                      <span className="ml-auto text-text-secondary/60 hover:text-text cursor-default text-[13px] font-bold">
                        ×
                      </span>
                    </div>
                  </div>
                  {/* Browser URL Bar */}
                  <div className="bg-card px-3 py-2 rounded-b-[6px] border-x border-b border-border/30 flex items-center gap-2 text-xs text-text-secondary">
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs">🔒</span>
                    <span className="font-mono text-[11px] text-text-secondary/80">
                      localhost:5173/overview
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Resolution Display Previews */}
              <div>
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                  Multi-Resolution Display Previews
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 16x16 */}
                  <div className="rounded-[8px] border border-border bg-card p-3 shadow-xs flex flex-col items-center text-center">
                    <div className="h-14 w-full flex items-center justify-center rounded-[6px] bg-surface/50 border border-border/40 mb-2">
                      <div className="h-4 w-4 flex items-center justify-center">
                        {activeFaviconUrl ? (
                          <img
                            src={activeFaviconUrl}
                            alt="16x16 Favicon"
                            className="h-4 w-4 object-contain"
                          />
                        ) : (
                          <div className="h-4 w-4 rounded-[2px] bg-[#2563EB] flex items-center justify-center text-white">
                            <Activity className="h-2.5 w-2.5" />
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-text">16 × 16 px</span>
                    <span className="text-[10px] text-text-secondary">Standard Browser Tab</span>
                  </div>

                  {/* 32x32 */}
                  <div className="rounded-[8px] border border-border bg-card p-3 shadow-xs flex flex-col items-center text-center">
                    <div className="h-14 w-full flex items-center justify-center rounded-[6px] bg-surface/50 border border-border/40 mb-2">
                      <div className="h-8 w-8 flex items-center justify-center">
                        {activeFaviconUrl ? (
                          <img
                            src={activeFaviconUrl}
                            alt="32x32 Favicon"
                            className="h-8 w-8 object-contain"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-[4px] bg-[#2563EB] flex items-center justify-center text-white">
                            <Activity className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-text">32 × 32 px</span>
                    <span className="text-[10px] text-text-secondary">Retina & OS Taskbar</span>
                  </div>

                  {/* 48x48 */}
                  <div className="rounded-[8px] border border-border bg-card p-3 shadow-xs flex flex-col items-center text-center">
                    <div className="h-14 w-full flex items-center justify-center rounded-[6px] bg-surface/50 border border-border/40 mb-2">
                      <div className="h-12 w-12 flex items-center justify-center">
                        {activeFaviconUrl ? (
                          <img
                            src={activeFaviconUrl}
                            alt="48x48 Favicon"
                            className="h-12 w-12 object-contain"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-[6px] bg-[#2563EB] flex items-center justify-center text-white">
                            <Activity className="h-7 w-7" />
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-text">48 × 48 px</span>
                    <span className="text-[10px] text-text-secondary">
                      High-DPI Bookmark / Shortcut
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Card 4: Platform Attribution */}
        <Card padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <CardHeader
              title="Platform Attribution"
              subtitle="Configure the vendor credit and white-label attribution displayed in the login screen footer."
            />
            <button
              type="button"
              onClick={handleRestoreDefaultAttribution}
              disabled={isSaving || isResetting}
              className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-[6px] border border-border bg-card px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface hover:text-text transition-colors shadow-xs"
              title="Reset attribution to 'Powered by ELLCRAFTS'"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Attribution</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Toggle: Enable / Disable Attribution */}
            <div className="flex items-center justify-between rounded-[8px] border border-border bg-surface/40 p-3.5">
              <div className="space-y-0.5">
                <label
                  htmlFor="toggle-attribution"
                  className="text-xs font-semibold text-text cursor-pointer"
                >
                  Display Platform Attribution
                </label>
                <p className="text-[11px] text-text-secondary">
                  Show "Powered by {stagedAttributionText.trim() || 'ELLCRAFTS'}" at the bottom right of the login screen.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-attribution"
                  type="checkbox"
                  checked={stagedShowAttribution}
                  onChange={(e) => {
                    setStagedShowAttribution(e.target.checked)
                    setValidationError(null)
                    setServerError(null)
                  }}
                  className="sr-only peer"
                  aria-label="Toggle platform attribution display"
                />
                <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
              </label>
            </div>

            {/* Attribution Brand Name Input */}
            <div className={cn('space-y-3 transition-opacity', !stagedShowAttribution && 'opacity-60')}>
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="attribution-text-input"
                    className="block text-xs font-semibold text-text"
                  >
                    Attribution Brand Name <span className="text-critical">*</span>
                  </label>
                  <span
                    className={cn(
                      'text-[11px] tabular',
                      stagedAttributionText.length > 64
                        ? 'font-bold text-critical'
                        : 'text-text-secondary',
                    )}
                  >
                    {stagedAttributionText.length} / 64
                  </span>
                </div>
                <div className="mt-1.5 flex rounded-[6px] border border-border bg-card overflow-hidden focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
                  <span className="inline-flex items-center bg-surface px-3 text-xs text-text-secondary border-r border-border select-none">
                    Powered by
                  </span>
                  <input
                    id="attribution-text-input"
                    type="text"
                    maxLength={64}
                    value={stagedAttributionText}
                    onChange={(e) => {
                      setStagedAttributionText(e.target.value)
                      setValidationError(null)
                      setServerError(null)
                    }}
                    disabled={!stagedShowAttribution}
                    placeholder="e.g. ELLCRAFTS"
                    className="h-10 w-full bg-transparent px-3 text-xs text-text placeholder:text-text-secondary/60 outline-none disabled:cursor-not-allowed"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-text-secondary">
                  The prefix "Powered by" is fixed. Enter the vendor or engineering organization name (1–64 characters).
                </p>
                {stagedShowAttribution && stagedAttributionText.trim().length === 0 ? (
                  <p className="mt-1 text-[11px] font-medium text-critical">
                    Attribution brand name cannot be empty when attribution display is enabled.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Live Footer Preview Tile */}
            <div className="rounded-[8px] border border-border bg-card p-3.5 shadow-xs">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                Login Footer Preview
              </span>
              <div className="flex items-center justify-between rounded-[6px] border border-border/80 bg-slate-50 px-4 py-3">
                <span className="text-[11px] text-slate-400 italic">
                  [Login Panel Content]
                </span>
                {stagedShowAttribution ? (
                  <div className="text-xs text-slate-400 select-none">
                    <span>
                      Powered by{' '}
                      <span className="font-semibold text-slate-700 tracking-tight">
                        {stagedAttributionText.trim() || 'ELLCRAFTS'}
                      </span>
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400 italic">
                    (Attribution footer hidden)
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Card 4: Login Website Link */}
        <Card padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <CardHeader
              title="Login Website Link"
              subtitle="Configure the official external website link embedded inside the Login CTA button."
            />
            <button
              type="button"
              onClick={handleRestoreDefaultWebsiteLink}
              disabled={isSaving || isResetting}
              className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-[6px] border border-border bg-card px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface hover:text-text transition-colors shadow-xs"
              title="Reset website link to 'www.ellcrafts.com'"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Link Defaults</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Toggle: Enable / Disable Website Link */}
            <div className="flex items-center justify-between rounded-[8px] border border-border bg-surface/40 p-3.5">
              <div className="space-y-0.5">
                <label
                  htmlFor="toggle-website-link"
                  className="text-xs font-semibold text-text cursor-pointer"
                >
                  Enable Website Link in Login CTA
                </label>
                <p className="text-[11px] text-text-secondary">
                  Embed an interactive secondary link to your website inside the Sign In button.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-website-link"
                  type="checkbox"
                  checked={stagedWebsiteLinkEnabled}
                  onChange={(e) => {
                    setStagedWebsiteLinkEnabled(e.target.checked)
                    setValidationError(null)
                    setServerError(null)
                  }}
                  className="sr-only peer"
                  aria-label="Toggle website link inside login CTA"
                />
                <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
              </label>
            </div>

            {/* Inputs Container */}
            <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity', !stagedWebsiteLinkEnabled && 'opacity-60')}>
              {/* Display Text Input */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="website-link-text-input"
                    className="block text-xs font-semibold text-text"
                  >
                    Display Text <span className="text-critical">*</span>
                  </label>
                  <span
                    className={cn(
                      'text-[11px] tabular',
                      stagedWebsiteLinkText.length > 64
                        ? 'font-bold text-critical'
                        : 'text-text-secondary',
                    )}
                  >
                    {stagedWebsiteLinkText.length} / 64
                  </span>
                </div>
                <div className="mt-1.5 relative">
                  <input
                    id="website-link-text-input"
                    type="text"
                    maxLength={64}
                    value={stagedWebsiteLinkText}
                    onChange={(e) => {
                      setStagedWebsiteLinkText(e.target.value)
                      setValidationError(null)
                      setServerError(null)
                    }}
                    disabled={!stagedWebsiteLinkEnabled}
                    placeholder="e.g. www.ellcrafts.com or Visit ELLCRAFTS"
                    className="h-10 w-full rounded-[6px] border border-border bg-card px-3 text-xs text-text placeholder:text-text-secondary/60 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent disabled:cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-[11px] text-text-secondary">
                  Label shown inside the CTA button (1–64 chars).
                </p>
                {stagedWebsiteLinkEnabled && stagedWebsiteLinkText.trim().length === 0 ? (
                  <p className="mt-1 text-[11px] font-medium text-critical">
                    Display text cannot be empty when website link is enabled.
                  </p>
                ) : null}
              </div>

              {/* Destination URL Input */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="website-link-url-input"
                    className="block text-xs font-semibold text-text"
                  >
                    Destination URL (HTTPS only) <span className="text-critical">*</span>
                  </label>
                  <span
                    className={cn(
                      'text-[11px] tabular',
                      stagedWebsiteLinkUrl.length > 512
                        ? 'font-bold text-critical'
                        : 'text-text-secondary',
                    )}
                  >
                    {stagedWebsiteLinkUrl.length} / 512
                  </span>
                </div>
                <div className="mt-1.5 relative">
                  <input
                    id="website-link-url-input"
                    type="url"
                    maxLength={512}
                    value={stagedWebsiteLinkUrl}
                    onChange={(e) => {
                      setStagedWebsiteLinkUrl(e.target.value)
                      setValidationError(null)
                      setServerError(null)
                    }}
                    disabled={!stagedWebsiteLinkEnabled}
                    placeholder="https://www.ellcrafts.com"
                    className="h-10 w-full rounded-[6px] border border-border bg-card px-3 text-xs text-text placeholder:text-text-secondary/60 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent disabled:cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-[11px] text-text-secondary">
                  Must be an external https:// URL.
                </p>
                {stagedWebsiteLinkEnabled && !validateClientHttpsUrl(stagedWebsiteLinkUrl).valid ? (
                  <p className="mt-1 text-[11px] font-medium text-critical">
                    {validateClientHttpsUrl(stagedWebsiteLinkUrl).error}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Live CTA Interactive Preview Tile */}
            <div className="rounded-[8px] border border-border bg-card p-3.5 shadow-xs">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                Login CTA Live Preview
              </span>
              <div className="flex items-center justify-center rounded-[6px] border border-border/80 bg-slate-50 p-6">
                <div className="w-full max-w-sm">
                  {/* Full-width blue Sign in button */}
                  <div className="flex h-11 w-full items-center justify-center rounded-[8px] bg-blue-600 text-sm font-semibold text-white shadow-xs select-none">
                    Sign in
                  </div>

                  {/* Centered Website Link directly below in exact Powered By brand colour */}
                  {stagedWebsiteLinkEnabled ? (
                    <div className="mt-4 flex justify-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 tracking-tight select-none">
                        <span>{stagedWebsiteLinkText.trim() || 'www.ellcrafts.com'}</span>
                        <ExternalLink className="h-3 w-3 text-slate-700" />
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Card 5: Live System Preview */}
        <Card padding="md">
          <CardHeader
            title="Live System Preview"
            subtitle="Real-time visualization of how your branding renders across key application interfaces."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tile A: Sidebar Header Preview */}
            <div className="rounded-[8px] border border-border bg-card p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-3">
                Sidebar Navigation
              </span>
              <div className="flex items-center gap-2.5 rounded-[8px] border border-border bg-card p-3 shadow-xs">
                {activeLogoUrl ? (
                  <img
                    src={activeLogoUrl}
                    alt="Logo Preview"
                    className="h-8 w-8 rounded-[6px] object-contain bg-white shadow-xs p-0.5 border border-border/50"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-accent text-white shadow-xs">
                    <Activity className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-text">
                    {stagedCompanyName.trim() || 'TEST_EMS'}
                  </p>
                  <p className="truncate text-[10px] font-medium text-text-secondary">
                    Energy Management
                  </p>
                </div>
              </div>
            </div>

            {/* Tile B: Header Brand Bar Preview */}
            <div className="rounded-[8px] border border-border bg-card p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block mb-3">
                Application Header
              </span>
              <div className="flex items-center justify-between rounded-[8px] border border-border bg-card p-3 shadow-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {activeLogoUrl ? (
                    <img
                      src={activeLogoUrl}
                      alt="Logo Preview"
                      className="h-6 w-6 rounded object-contain bg-white shadow-xs p-0.5 border border-border/50"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-white shadow-xs">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <p className="truncate text-xs font-semibold text-text">
                    {stagedCompanyName.trim() || 'TEST_EMS'}
                  </p>
                </div>
                <span className="rounded-[4px] bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                  LIVE
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Bar (Static on mobile to prevent bottom-nav collision, Sticky on desktop) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-[8px] border border-border bg-card/95 p-3.5 shadow-popover backdrop-blur-md md:sticky md:bottom-4 z-10">
          <div className="text-xs text-text-secondary">
            {isDirty ? (
              <span className="font-medium text-accent flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                Unsaved modifications staged
              </span>
            ) : (
              <span>All changes saved to system database</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={!isDirty || isSaving || isResetting}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3.5 py-2 text-xs font-medium text-text hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={!canSave}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Default Branding Reset */}
      {showResetConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-[10px] border border-border bg-card p-5 shadow-popover space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-critical/10 text-critical">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-text">Restore Default Branding?</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  This will reset the organization name back to <strong>TEST_EMS</strong>, restore platform attribution to <strong>Powered by ELLCRAFTS</strong>, reset the login CTA link to <strong>www.ellcrafts.com</strong>, and delete any
                  custom logo from persistent storage. Active sessions will immediately reflect default branding.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="inline-flex items-center gap-1.5 rounded-[6px] bg-critical px-3 py-1.5 text-xs font-medium text-white hover:bg-critical/90 transition-colors shadow-xs"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Restoring…
                  </>
                ) : (
                  'Yes, Restore Defaults'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
