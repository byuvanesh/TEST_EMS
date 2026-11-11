// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import * as BrandingContextModule from '@/context/BrandingContext'
import * as AuthContextModule from '@/context/AuthContext'

describe('LoginPage Center Alignment & Layout Refinement', () => {
  const mockAuthContext = {
    user: null,
    loading: false,
    login: vi.fn().mockResolvedValue({ ok: true }),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshMe: vi.fn(),
  }

  const defaultBranding = {
    companyName: 'ELLCRAFTS',
    logoUrl: null,
    faviconUrl: null,
    showAttribution: true,
    attributionText: 'ELLCRAFTS',
    websiteLinkEnabled: true,
    websiteLinkText: 'www.ellcrafts.com',
    websiteLinkUrl: 'https://www.ellcrafts.com',
    refreshBranding: vi.fn(),
    updateBrandingState: vi.fn(),
  }

  function renderLoginPage(brandingOverrides = {}) {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockAuthContext as any)
    vi.spyOn(BrandingContextModule, 'useBranding').mockReturnValue({
      ...defaultBranding,
      ...brandingOverrides,
    } as any)

    const html = renderToString(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    const parser = new DOMParser()
    return parser.parseFromString(html, 'text/html')
  }

  it('renders a full-height centered layout container', () => {
    const doc = renderLoginPage()
    const container = doc.querySelector('.min-h-screen')
    expect(container).not.toBeNull()
    expect(container?.className).toContain('flex')
    expect(container?.className).toContain('flex-col')
    expect(container?.className).toContain('justify-between')

    const main = doc.querySelector('main')
    expect(main).not.toBeNull()
    expect(main?.className).toContain('items-center')
    expect(main?.className).toContain('justify-center')

    const centeredWrapper = main?.querySelector('.max-w-\\[420px\\]')
    expect(centeredWrapper).not.toBeNull()
    expect(centeredWrapper?.className).toContain('mx-auto')
  })

  it('renders company branding in strict vertical order: Logo -> Company Name -> Subtitle', () => {
    const doc = renderLoginPage({
      companyName: 'ACME ENERGY CORP',
      logoUrl: '/api/system/branding/logo?v=test123',
    })

    const brandingBlock = doc.querySelector('[data-testid="brand-vertical-stack"]')
    expect(brandingBlock).not.toBeNull()
    expect(brandingBlock?.className).toContain('flex-col')
    expect(brandingBlock?.className).toContain('items-center')
    expect(brandingBlock?.className).toContain('text-center')

    const children = Array.from(brandingBlock?.children || [])
    expect(children.length).toBe(3)

    // 1. Logo container at the top, centered
    const logoContainer = doc.querySelector('[data-testid="brand-logo-container"]')
    expect(logoContainer).not.toBeNull()
    expect(logoContainer?.className).toContain('mx-auto')
    const img = logoContainer?.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('/api/system/branding/logo?v=test123')
    expect(img?.getAttribute('alt')).toBe('ACME ENERGY CORP')
    expect(img?.className).toContain('object-contain')

    // 2. Company name directly below logo, centered
    const nameEl = doc.querySelector('[data-testid="brand-company-name"]')
    expect(nameEl).not.toBeNull()
    expect(nameEl?.tagName.toLowerCase()).toBe('h1')
    expect(nameEl?.textContent?.trim()).toBe('ACME ENERGY CORP')
    expect(nameEl?.className).toContain('text-center')

    // 3. Subtitle directly below company name, centered
    const subtitleEl = doc.querySelector('[data-testid="brand-subtitle"]')
    expect(subtitleEl).not.toBeNull()
    expect(subtitleEl?.tagName.toLowerCase()).toBe('p')
    expect(subtitleEl?.textContent).toContain('Energy Management System')
    expect(subtitleEl?.className).toContain('text-center')
    expect(subtitleEl?.className).toContain('justify-center')
  })

  it('renders default Activity icon when no custom logo is uploaded', () => {
    const doc = renderLoginPage({ logoUrl: null })
    const logoContainer = doc.querySelector('[data-testid="brand-logo-container"]')
    expect(logoContainer?.querySelector('img')).toBeNull()
    expect(logoContainer?.querySelector('svg')).not.toBeNull()
  })

  it('renders Sign in heading and description center-aligned', () => {
    const doc = renderLoginPage()
    const signinHeader = doc.querySelector('h2')
    expect(signinHeader?.textContent?.trim()).toBe('Sign in')
    expect(signinHeader?.parentElement?.className).toContain('text-center')

    const description = signinHeader?.nextElementSibling
    expect(description?.textContent?.trim()).toBe(
      'Enter your credentials to access the facility dashboard.'
    )
  })

  it('keeps username and password labels and inputs left-aligned inside the card', () => {
    const doc = renderLoginPage()
    const userLabel = doc.querySelector('label[for$="-user"]')
    expect(userLabel).not.toBeNull()
    expect(userLabel?.className).toContain('text-left')

    const userInput = doc.querySelector('input[name="username"]')
    expect(userInput).not.toBeNull()
    expect(userInput?.className).toContain('text-left')

    const passLabel = doc.querySelector('label[for$="-pass"]')
    expect(passLabel).not.toBeNull()
    expect(passLabel?.className).toContain('text-left')

    const passInput = doc.querySelector('input[name="password"]')
    expect(passInput).not.toBeNull()
    expect(passInput?.className).toContain('text-left')
  })

  it('renders a full-width Sign in button', () => {
    const doc = renderLoginPage()
    const submitBtn = doc.querySelector('button[type="submit"]')
    expect(submitBtn).not.toBeNull()
    expect(submitBtn?.className).toContain('w-full')
    expect(submitBtn?.className).toContain('bg-blue-600')
    expect(submitBtn?.textContent?.trim()).toBe('Sign in')
  })

  it('renders website link centered directly below Sign in button', () => {
    const doc = renderLoginPage({
      websiteLinkEnabled: true,
      websiteLinkText: 'www.ellcrafts.com',
      websiteLinkUrl: 'https://www.ellcrafts.com',
    })

    const linkContainer = doc.querySelector('[data-testid="login-website-link"]')?.parentElement
    expect(linkContainer).not.toBeNull()
    expect(linkContainer?.className).toContain('flex')
    expect(linkContainer?.className).toContain('justify-center')

    const link = doc.querySelector('[data-testid="login-website-link"]')
    expect(link?.getAttribute('href')).toBe('https://www.ellcrafts.com')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.textContent).toContain('www.ellcrafts.com')
    // Uses slate-700 exact same color as powered-by
    expect(link?.className).toContain('text-slate-700')
  })

  it('hides website link when disabled in branding settings', () => {
    const doc = renderLoginPage({ websiteLinkEnabled: false })
    const link = doc.querySelector('[data-testid="login-website-link"]')
    expect(link).toBeNull()
  })

  it('renders Powered by footer horizontally centered at the bottom of the viewport', () => {
    const doc = renderLoginPage({
      showAttribution: true,
      attributionText: 'ELLCRAFTS',
    })

    const footer = doc.querySelector('[data-testid="platform-attribution-footer"]')
    expect(footer).not.toBeNull()
    expect(footer?.className).toContain('flex')
    expect(footer?.className).toContain('justify-center')
    expect(footer?.className).toContain('text-center')
    expect(footer?.textContent).toContain('Powered by')
    expect(footer?.textContent).toContain('ELLCRAFTS')
    // Attribution wordmark styling
    const wordmark = footer?.querySelector('span span')
    expect(wordmark?.className).toContain('text-slate-700')
    expect(wordmark?.className).toContain('font-semibold')
  })

  it('omits Powered by footer completely when disabled with zero gap', () => {
    const doc = renderLoginPage({ showAttribution: false })
    const footer = doc.querySelector('[data-testid="platform-attribution-footer"]')
    expect(footer).toBeNull()
  })
})
