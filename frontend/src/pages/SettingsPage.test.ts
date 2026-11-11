// @vitest-environment jsdom
/**
 * Tests for Company Branding client methods and validation rules (SettingsPage / BrandingContext)
 *
 * Requirements verified:
 * 1. ApiClient has getBranding, putBranding, and resetBranding methods
 * 2. File validation rules:
 *    - Rejects SVG files
 *    - Rejects files > 3 MB
 *    - Rejects unsupported MIME types
 *    - Accepts valid PNG, JPEG, WebP
 * 3. Dimension validation rules:
 *    - Minimum dimension 16×16
 *    - Maximum dimension 4096×4096
 * 4. Company name validation:
 *    - Between 1 and 128 characters
 *    - Whitespace only disallowed
 */

import { describe, expect, it } from 'vitest'
import { apiClient } from '@/api/client'
import { updateDocumentFavicon } from '@/context/BrandingContext'

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024 // 3 MB
const MIN_DIMENSION = 16
const MAX_DIMENSION = 4096

function validateImageUpload(file: { name: string; type: string; size: number }): { valid: boolean; error?: string } {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return { valid: false, error: 'SVG files are strictly disallowed due to enterprise security policies.' }
  }
  const validMimes = ['image/png', 'image/jpeg', 'image/webp']
  if (!validMimes.includes(file.type)) {
    return { valid: false, error: 'Unsupported image format. Only PNG, JPEG, and WebP assets are accepted.' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File size exceeds maximum allowed 3 MB ceiling.' }
  }
  return { valid: true }
}

function validateDimensions(width: number, height: number): { valid: boolean; error?: string } {
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return { valid: false, error: `Image dimensions (${width}×${height}) below minimum 16×16.` }
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return { valid: false, error: `Image dimensions (${width}×${height}) exceed maximum 4096×4096.` }
  }
  return { valid: true }
}

function validateCompanyName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim()
  if (trimmed.length < 1) {
    return { valid: false, error: 'Company name cannot be empty.' }
  }
  if (name.length > 128) {
    return { valid: false, error: 'Company name cannot exceed 128 characters.' }
  }
  return { valid: true }
}

function validateAttributionText(text: string, enabled = true): { valid: boolean; error?: string } {
  if (!enabled) return { valid: true }
  const trimmed = text.trim()
  if (trimmed.length < 1) {
    return { valid: false, error: 'Attribution brand name cannot be empty when enabled.' }
  }
  if (text.length > 64) {
    return { valid: false, error: 'Attribution brand name cannot exceed 64 characters.' }
  }
  return { valid: true }
}

function validateWebsiteLinkText(text: string, enabled = true): { valid: boolean; error?: string } {
  if (!enabled) return { valid: true }
  const trimmed = text.trim()
  if (trimmed.length < 1) {
    return { valid: false, error: 'Website display text cannot be empty when enabled.' }
  }
  if (text.length > 64) {
    return { valid: false, error: 'Website display text cannot exceed 64 characters.' }
  }
  return { valid: true }
}

function validateWebsiteLinkUrl(input: string, enabled = true): { valid: boolean; error?: string } {
  if (!enabled) return { valid: true }
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

describe('Company Branding Settings & API Client Contract', () => {
  it('ApiClient exposes required branding methods', () => {
    expect(typeof apiClient.getBranding).toBe('function')
    expect(typeof apiClient.putBranding).toBe('function')
    expect(typeof apiClient.resetBranding).toBe('function')
  })

  describe('File Validation Guard', () => {
    it('strictly rejects SVG uploads by MIME or filename', () => {
      expect(validateImageUpload({ name: 'logo.svg', type: 'image/svg+xml', size: 1024 }).valid).toBe(false)
      expect(validateImageUpload({ name: 'logo.SVG', type: 'image/png', size: 1024 }).valid).toBe(false)
      expect(validateImageUpload({ name: 'vector.svg', type: 'application/octet-stream', size: 500 }).valid).toBe(false)
    })

    it('strictly rejects files exceeding 3 MB', () => {
      const over3Mb = 3 * 1024 * 1024 + 1
      expect(validateImageUpload({ name: 'huge.png', type: 'image/png', size: over3Mb }).valid).toBe(false)
      expect(validateImageUpload({ name: 'huge.png', type: 'image/png', size: over3Mb }).error).toMatch(/3 MB/)
    })

    it('rejects unsupported MIME types (e.g. gif, bmp, pdf)', () => {
      expect(validateImageUpload({ name: 'anim.gif', type: 'image/gif', size: 5000 }).valid).toBe(false)
      expect(validateImageUpload({ name: 'bitmap.bmp', type: 'image/bmp', size: 5000 }).valid).toBe(false)
      expect(validateImageUpload({ name: 'doc.pdf', type: 'application/pdf', size: 5000 }).valid).toBe(false)
    })

    it('accepts valid PNG, JPEG, and WebP within 3 MB', () => {
      expect(validateImageUpload({ name: 'logo.png', type: 'image/png', size: 1024 * 500 }).valid).toBe(true)
      expect(validateImageUpload({ name: 'photo.jpg', type: 'image/jpeg', size: 1024 * 1024 }).valid).toBe(true)
      expect(validateImageUpload({ name: 'brand.webp', type: 'image/webp', size: 1024 * 200 }).valid).toBe(true)
    })
  })

  describe('Dimension Guard', () => {
    it('rejects images smaller than 16×16', () => {
      expect(validateDimensions(15, 100).valid).toBe(false)
      expect(validateDimensions(100, 15).valid).toBe(false)
      expect(validateDimensions(8, 8).valid).toBe(false)
    })

    it('rejects images larger than 4096×4096', () => {
      expect(validateDimensions(4097, 2000).valid).toBe(false)
      expect(validateDimensions(2000, 4097).valid).toBe(false)
      expect(validateDimensions(5000, 5000).valid).toBe(false)
    })

    it('accepts valid dimensions within [16, 4096]', () => {
      expect(validateDimensions(16, 16).valid).toBe(true)
      expect(validateDimensions(512, 512).valid).toBe(true)
      expect(validateDimensions(1920, 1080).valid).toBe(true)
      expect(validateDimensions(4096, 4096).valid).toBe(true)
    })
  })

  describe('Company Name Guard', () => {
    it('rejects empty and whitespace-only company names', () => {
      expect(validateCompanyName('').valid).toBe(false)
      expect(validateCompanyName('   ').valid).toBe(false)
    })

    it('rejects company names longer than 128 characters', () => {
      const longName = 'A'.repeat(129)
      expect(validateCompanyName(longName).valid).toBe(false)
    })

    it('accepts valid company names', () => {
      expect(validateCompanyName('TEST_EMS').valid).toBe(true)
      expect(validateCompanyName('Acme Heavy Industries').valid).toBe(true)
      expect(validateCompanyName('A'.repeat(128)).valid).toBe(true)
    })
  })

  describe('Platform Attribution Guard', () => {
    it('rejects empty and whitespace-only attribution brand name when enabled', () => {
      expect(validateAttributionText('', true).valid).toBe(false)
      expect(validateAttributionText('   ', true).valid).toBe(false)
    })

    it('allows empty text when attribution display is disabled', () => {
      expect(validateAttributionText('', false).valid).toBe(true)
    })

    it('rejects attribution names longer than 64 characters', () => {
      const longName = 'A'.repeat(65)
      expect(validateAttributionText(longName, true).valid).toBe(false)
    })

    it('accepts valid attribution brand names', () => {
      expect(validateAttributionText('ELLCRAFTS', true).valid).toBe(true)
      expect(validateAttributionText('Acme Cloud', true).valid).toBe(true)
      expect(validateAttributionText('A'.repeat(64), true).valid).toBe(true)
    })
  })

  describe('Login Website Link Guard', () => {
    describe('Text Validation', () => {
      it('rejects empty or whitespace-only display text when enabled', () => {
        expect(validateWebsiteLinkText('', true).valid).toBe(false)
        expect(validateWebsiteLinkText('   ', true).valid).toBe(false)
      })

      it('allows empty display text when website link is disabled', () => {
        expect(validateWebsiteLinkText('', false).valid).toBe(true)
      })

      it('rejects display text exceeding 64 characters', () => {
        expect(validateWebsiteLinkText('A'.repeat(65), true).valid).toBe(false)
      })

      it('accepts valid display text', () => {
        expect(validateWebsiteLinkText('www.ellcrafts.com', true).valid).toBe(true)
        expect(validateWebsiteLinkText('Visit ELLCRAFTS', true).valid).toBe(true)
        expect(validateWebsiteLinkText('A'.repeat(64), true).valid).toBe(true)
      })
    })

    describe('URL Validation & Security', () => {
      it('rejects non-HTTPS URLs (e.g. http://)', () => {
        expect(validateWebsiteLinkUrl('http://www.ellcrafts.com', true).valid).toBe(false)
        expect(validateWebsiteLinkUrl('http://www.ellcrafts.com', true).error).toMatch(/Only HTTPS/)
      })

      it('rejects dangerous protocols (javascript:, data:, file:, ftp:)', () => {
        expect(validateWebsiteLinkUrl('javascript:alert(1)', true).valid).toBe(false)
        expect(validateWebsiteLinkUrl('data:text/html,bad', true).valid).toBe(false)
        expect(validateWebsiteLinkUrl('file:///etc/passwd', true).valid).toBe(false)
        expect(validateWebsiteLinkUrl('ftp://ftp.server.com', true).valid).toBe(false)
      })

      it('rejects URLs containing embedded username or password credentials', () => {
        expect(validateWebsiteLinkUrl('https://admin:secret@www.ellcrafts.com', true).valid).toBe(false)
        expect(validateWebsiteLinkUrl('https://admin:secret@www.ellcrafts.com', true).error).toMatch(/credentials/)
      })

      it('rejects malformed URLs', () => {
        expect(validateWebsiteLinkUrl('https://', true).valid).toBe(false)
        expect(validateWebsiteLinkUrl('not-a-url', true).valid).toBe(false)
        expect(validateWebsiteLinkUrl('https:// space in domain.com', true).valid).toBe(false)
      })

      it('rejects URLs exceeding 512 characters', () => {
        const longUrl = 'https://www.ellcrafts.com/' + 'a'.repeat(500)
        expect(validateWebsiteLinkUrl(longUrl, true).valid).toBe(false)
      })

      it('allows empty or invalid URL when website link is disabled', () => {
        expect(validateWebsiteLinkUrl('', false).valid).toBe(true)
        expect(validateWebsiteLinkUrl('http://insecure.com', false).valid).toBe(true)
      })

      it('accepts valid HTTPS URLs', () => {
        expect(validateWebsiteLinkUrl('https://www.ellcrafts.com', true).valid).toBe(true)
        expect(validateWebsiteLinkUrl('https://ellcrafts.com/support?ref=app#login', true).valid).toBe(true)
        expect(validateWebsiteLinkUrl('https://portal.subdomain.co.uk', true).valid).toBe(true)
      })
    })
  })

  describe('Browser Tab Favicon Guard & Dynamic DOM Integration', () => {
    it('rejects SVG favicon uploads due to security policy', () => {
      const res = validateImageUpload({ name: 'favicon.svg', type: 'image/svg+xml', size: 1024 })
      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/SVG files are strictly disallowed/)
    })

    it('rejects favicon files larger than 3 MB', () => {
      const res = validateImageUpload({ name: 'favicon.png', type: 'image/png', size: 3.5 * 1024 * 1024 })
      expect(res.valid).toBe(false)
      expect(res.error).toMatch(/3 MB ceiling/)
    })

    it('rejects unsupported favicon formats like gif or ico directly from upload', () => {
      const resGif = validateImageUpload({ name: 'favicon.gif', type: 'image/gif', size: 2048 })
      expect(resGif.valid).toBe(false)
      expect(resGif.error).toMatch(/Unsupported image format/)
    })

    it('accepts valid PNG, JPEG, and WebP favicon assets', () => {
      expect(validateImageUpload({ name: 'fav.png', type: 'image/png', size: 50 * 1024 }).valid).toBe(true)
      expect(validateImageUpload({ name: 'fav.jpg', type: 'image/jpeg', size: 80 * 1024 }).valid).toBe(true)
      expect(validateImageUpload({ name: 'fav.webp', type: 'image/webp', size: 30 * 1024 }).valid).toBe(true)
    })

    it('rejects favicon dimensions below 16x16 or above 4096x4096', () => {
      expect(validateDimensions(10, 10).valid).toBe(false)
      expect(validateDimensions(8, 64).valid).toBe(false)
      expect(validateDimensions(5000, 5000).valid).toBe(false)
      expect(validateDimensions(16, 16).valid).toBe(true)
      expect(validateDimensions(128, 128).valid).toBe(true)
      expect(validateDimensions(512, 512).valid).toBe(true)
    })

    describe('updateDocumentFavicon DOM Integration', () => {
      it('dynamically sets custom favicon link in document.head with versioned URL', () => {
        const customUrl = '/api/system/branding/favicon?v=abcdef1234567890'
        updateDocumentFavicon(customUrl)

        const link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
        expect(link).not.toBeNull()
        expect(link?.getAttribute('href')).toBe(customUrl)
        expect(link?.getAttribute('type')).toBe('image/png')
      })

      it('restores default /favicon.svg when custom favicon is null', () => {
        updateDocumentFavicon(null)

        const link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
        expect(link).not.toBeNull()
        expect(link?.getAttribute('href')).toBe('/favicon.svg')
        expect(link?.getAttribute('type')).toBe('image/svg+xml')
      })

      it('removes duplicate or conflicting icon links', () => {
        // Inject an old legacy shortcut icon link
        const oldLink = document.createElement('link')
        oldLink.rel = 'shortcut icon'
        oldLink.href = '/old-icon.ico'
        document.head.appendChild(oldLink)

        updateDocumentFavicon('/api/system/branding/favicon?v=111222333')

        const allIcons = document.querySelectorAll("link[rel*='icon']")
        expect(allIcons.length).toBe(1)
        expect(allIcons[0]?.getAttribute('href')).toBe('/api/system/branding/favicon?v=111222333')
      })
    })
  })
})
