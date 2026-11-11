import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiClient, type ApiBranding, type PutBrandingPayload, ApiError } from '@/api/client'

export interface BrandingContextValue {
  companyName: string
  logoUrl: string | null
  showAttribution: boolean
  attributionText: string
  websiteLinkEnabled: boolean
  websiteLinkText: string
  websiteLinkUrl: string
  faviconUrl: string | null
  hasCustomFavicon: boolean
  updatedAt: string | null
  isLoading: boolean
  error: string | null
  updateBranding: (payload: PutBrandingPayload) => Promise<{ ok: boolean; branding?: ApiBranding; error?: string }>
  resetBranding: () => Promise<{ ok: boolean; branding?: ApiBranding; error?: string }>
  refreshBranding: () => Promise<void>
}

const DEFAULT_COMPANY_NAME = 'TEST_EMS'
const DEFAULT_ATTRIBUTION_TEXT = 'ELLCRAFTS'
const DEFAULT_WEBSITE_LINK_TEXT = 'www.ellcrafts.com'
const DEFAULT_WEBSITE_LINK_URL = 'https://www.ellcrafts.com'

/**
 * Dynamically updates the browser's favicon <link> element in document.head.
 * - Uses versioned URL based on SHA-256 hash
 * - Cleans up existing/conflicting icon tags
 * - Falls back cleanly to /favicon.svg when custom favicon is null
 */
export function updateDocumentFavicon(faviconUrl: string | null): void {
  if (typeof document === 'undefined') return

  const targetHref = faviconUrl || '/favicon.svg'
  const targetType = faviconUrl ? 'image/png' : 'image/svg+xml'

  const currentLink = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (currentLink && currentLink.getAttribute('href') === targetHref) {
    return
  }

  const existingLinks = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']")
  existingLinks.forEach((link) => link.remove())

  const newLink = document.createElement('link')
  newLink.rel = 'icon'
  newLink.type = targetType
  newLink.href = targetHref
  document.head.appendChild(newLink)
}

const BrandingContext = createContext<BrandingContextValue | null>(null)

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [companyName, setCompanyName] = useState<string>(DEFAULT_COMPANY_NAME)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [showAttribution, setShowAttribution] = useState<boolean>(true)
  const [attributionText, setAttributionText] = useState<string>(DEFAULT_ATTRIBUTION_TEXT)
  const [websiteLinkEnabled, setWebsiteLinkEnabled] = useState<boolean>(true)
  const [websiteLinkText, setWebsiteLinkText] = useState<string>(DEFAULT_WEBSITE_LINK_TEXT)
  const [websiteLinkUrl, setWebsiteLinkUrl] = useState<string>(DEFAULT_WEBSITE_LINK_URL)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [hasCustomFavicon, setHasCustomFavicon] = useState<boolean>(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const refreshBranding = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await apiClient.getBranding()
      setCompanyName(data.company_name || DEFAULT_COMPANY_NAME)
      setLogoUrl(data.logo_url)
      setShowAttribution(data.show_attribution !== undefined ? Boolean(data.show_attribution) : true)
      setAttributionText(data.attribution_text || DEFAULT_ATTRIBUTION_TEXT)
      setWebsiteLinkEnabled(data.website_link_enabled !== undefined ? Boolean(data.website_link_enabled) : true)
      setWebsiteLinkText(data.website_link_text || DEFAULT_WEBSITE_LINK_TEXT)
      setWebsiteLinkUrl(data.website_link_url || DEFAULT_WEBSITE_LINK_URL)
      setFaviconUrl(data.favicon_url)
      setHasCustomFavicon(Boolean(data.has_custom_favicon))
      setUpdatedAt(data.updated_at)
      updateDocumentFavicon(data.favicon_url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load branding'
      setError(msg)
      // Fallback to defaults
      setCompanyName(DEFAULT_COMPANY_NAME)
      setLogoUrl(null)
      setShowAttribution(true)
      setAttributionText(DEFAULT_ATTRIBUTION_TEXT)
      setWebsiteLinkEnabled(true)
      setWebsiteLinkText(DEFAULT_WEBSITE_LINK_TEXT)
      setWebsiteLinkUrl(DEFAULT_WEBSITE_LINK_URL)
      setFaviconUrl(null)
      setHasCustomFavicon(false)
      updateDocumentFavicon(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshBranding()
  }, [refreshBranding])

  useEffect(() => {
    updateDocumentFavicon(faviconUrl)
  }, [faviconUrl])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${companyName} — Industrial Energy Management System`
    }
  }, [companyName])

  const updateBranding = useCallback(
    async (payload: PutBrandingPayload): Promise<{ ok: boolean; branding?: ApiBranding; error?: string }> => {
      try {
        setError(null)
        const res = await apiClient.putBranding(payload)
        setCompanyName(res.branding.company_name)
        setLogoUrl(res.branding.logo_url)
        setShowAttribution(res.branding.show_attribution !== undefined ? Boolean(res.branding.show_attribution) : true)
        setAttributionText(res.branding.attribution_text || DEFAULT_ATTRIBUTION_TEXT)
        setWebsiteLinkEnabled(res.branding.website_link_enabled !== undefined ? Boolean(res.branding.website_link_enabled) : true)
        setWebsiteLinkText(res.branding.website_link_text || DEFAULT_WEBSITE_LINK_TEXT)
        setWebsiteLinkUrl(res.branding.website_link_url || DEFAULT_WEBSITE_LINK_URL)
        setFaviconUrl(res.branding.favicon_url)
        setHasCustomFavicon(Boolean(res.branding.has_custom_favicon))
        setUpdatedAt(res.branding.updated_at)
        updateDocumentFavicon(res.branding.favicon_url)
        return { ok: true, branding: res.branding }
      } catch (err) {
        let msg = 'Failed to update company branding'
        if (err instanceof ApiError) {
          msg = err.message
        } else if (err instanceof Error) {
          msg = err.message
        }
        setError(msg)
        return { ok: false, error: msg }
      }
    },
    [],
  )

  const resetBranding = useCallback(async (): Promise<{ ok: boolean; branding?: ApiBranding; error?: string }> => {
    try {
      setError(null)
      const res = await apiClient.resetBranding()
      setCompanyName(res.branding.company_name)
      setLogoUrl(res.branding.logo_url)
      setShowAttribution(true)
      setAttributionText(DEFAULT_ATTRIBUTION_TEXT)
      setWebsiteLinkEnabled(true)
      setWebsiteLinkText(DEFAULT_WEBSITE_LINK_TEXT)
      setWebsiteLinkUrl(DEFAULT_WEBSITE_LINK_URL)
      setFaviconUrl(null)
      setHasCustomFavicon(false)
      setUpdatedAt(res.branding.updated_at)
      updateDocumentFavicon(null)
      return { ok: true, branding: res.branding }
    } catch (err) {
      let msg = 'Failed to reset company branding'
      if (err instanceof ApiError) {
        msg = err.message
      } else if (err instanceof Error) {
        msg = err.message
      }
      setError(msg)
      return { ok: false, error: msg }
    }
  }, [])

  const value = useMemo<BrandingContextValue>(
    () => ({
      companyName,
      logoUrl,
      showAttribution,
      attributionText,
      websiteLinkEnabled,
      websiteLinkText,
      websiteLinkUrl,
      faviconUrl,
      hasCustomFavicon,
      updatedAt,
      isLoading,
      error,
      updateBranding,
      resetBranding,
      refreshBranding,
    }),
    [
      companyName,
      logoUrl,
      showAttribution,
      attributionText,
      websiteLinkEnabled,
      websiteLinkText,
      websiteLinkUrl,
      faviconUrl,
      hasCustomFavicon,
      updatedAt,
      isLoading,
      error,
      updateBranding,
      resetBranding,
      refreshBranding,
    ],
  )

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext)
  if (!ctx) {
    throw new Error('useBranding must be used within a BrandingProvider')
  }
  return ctx
}
