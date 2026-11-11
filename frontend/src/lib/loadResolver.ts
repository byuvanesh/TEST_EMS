import type { ApiCatalogueLoad } from '@/api/client'

export interface LoadResolutionResult {
  uuid: string | null
  code: string | null
  load: ApiCatalogueLoad | null
  isNotFound: boolean
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolves a route load identifier (which could be a load code like 'AC-01'
 * or an existing UUID) to the backend load record and its primary UUID.
 *
 * Rules:
 * - Case-insensitive match on code ('AC-01', 'ac-01')
 * - Direct match on catalogue ID
 * - If not in catalogue but matches standard UUID format, returns UUID for backend lookup
 * - Returns isNotFound: true for unrecognized codes or empty input
 */
export function resolveLoadIdentifier(
  identifier: string | undefined | null,
  catalogue: ApiCatalogueLoad[] = [],
): LoadResolutionResult {
  if (!identifier || !identifier.trim()) {
    return { uuid: null, code: null, load: null, isNotFound: true }
  }

  const clean = identifier.trim()
  const cleanLower = clean.toLowerCase()

  // Match by code or id in catalogue
  const matched = catalogue.find(
    (l) => l.code.toLowerCase() === cleanLower || l.id.toLowerCase() === cleanLower,
  )

  if (matched) {
    return {
      uuid: matched.id,
      code: matched.code,
      load: matched,
      isNotFound: false,
    }
  }

  // If not in catalogue, but matches standard UUID pattern, permit direct UUID lookup
  if (UUID_REGEX.test(clean)) {
    return {
      uuid: clean,
      code: null,
      load: null,
      isNotFound: false,
    }
  }

  // Unrecognized code (not in catalogue and not a UUID)
  return {
    uuid: null,
    code: clean,
    load: null,
    isNotFound: true,
  }
}
