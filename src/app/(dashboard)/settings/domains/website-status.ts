// Pure module (no 'use client'): safe to import from Server Components such as page.tsx.
// Functions exported from a 'use client' file are client references on the server and throw when called.

export type WebsiteStatus = 'live' | 'maintenance' | 'draft'

/** `published` → live; draft that was live before → maintenance; otherwise draft. */
export function resolveWebsiteStatus(site: { status?: string | null; publishedAt?: string | null }): WebsiteStatus {
    if (site.status === 'published') return 'live'
    return site.publishedAt ? 'maintenance' : 'draft'
}
