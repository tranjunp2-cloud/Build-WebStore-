export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { parseRequest } from '@/lib/validations/helpers'
import { parseMapLink } from '@/lib/seo/map-links'

/**
 * POST /api/local-seo/resolve-maps-link
 *
 * F37 US-01 geocoding layers 2-3 (PRD §13.9). Layer 1 (client regex) already
 * ran in the browser and failed before this route is called.
 *
 * Layer 2 — server redirect-resolver: shortened links (`maps.app.goo.gl/*`,
 * `goo.gl/maps/*`) carry no coordinates in the URL itself; this route follows
 * the redirect chain server-side and re-parses the final URL with the same
 * layer-1 regex.
 *
 * Layer 3 — Google Geocoding API fallback: only runs when `address` was
 * provided AND `GOOGLE_MAPS_GEOCODING_API_KEY` is configured. The key is not
 * yet provisioned (PRD §14, "Pending") — this gracefully no-ops (skip, not
 * throw) so the client reveals the manual lat/lng disclosure instead.
 *
 * Body: { url?: string, address?: string } (at least one required)
 * Response: { lat: number, lng: number, source: 'redirect' | 'geocode' } (200)
 *        or { error: string } (400 invalid input / 401 unauthenticated / 422 all layers failed)
 *
 * Auth: any authenticated user — this is a stateless geocode utility, not a
 * data-mutating call, so no per-site tenant-ownership check is needed (unlike
 * `src/app/api/sites/[siteId]/save/route.ts`, which is not URL-scoped to a site).
 */

// SSRF mitigation: only ever fetch hosts Google itself uses for Maps links/redirects.
const ALLOWED_REDIRECT_HOSTS = new Set([
    'maps.app.goo.gl',
    'goo.gl',
    'www.google.com',
    'google.com',
    'maps.google.com',
])

const MAX_REDIRECT_HOPS = 5
const FETCH_TIMEOUT_MS = 4000

const bodySchema = z.object({
    url: z.string().trim().max(2048).optional(),
    address: z.string().trim().max(500).optional(),
}).refine(d => Boolean(d.url) || Boolean(d.address), { message: 'url or address is required' })

function isAllowedHost(url: string): boolean {
    try {
        return ALLOWED_REDIRECT_HOSTS.has(new URL(url).hostname.toLowerCase())
    } catch {
        return false
    }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
        return await fetch(url, { ...init, signal: controller.signal })
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}

/** Layer 2: follow the redirect chain, refusing to leave the host allowlist at
 *  any hop. HEAD-only — never reads a response body. Returns the final
 *  resolved URL, or null if disallowed/unresolvable/too many hops. */
async function resolveRedirect(startUrl: string): Promise<string | null> {
    let current = startUrl
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
        if (!isAllowedHost(current)) return null
        const res = await fetchWithTimeout(current, { method: 'HEAD', redirect: 'manual' })
        if (!res) return null
        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location')
            if (!location) return null
            let next: string
            try {
                next = new URL(location, current).toString()
            } catch {
                return null
            }
            if (!isAllowedHost(next)) return null
            current = next
            continue
        }
        return current
    }
    return null
}

/** Layer 3: Google Geocoding API — server-side only, key never exposed to client. */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    const apiKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY
    if (!apiKey) return null

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    const res = await fetchWithTimeout(url, { method: 'GET' })
    if (!res || !res.ok) return null

    try {
        const json = await res.json() as {
            results?: Array<{ geometry?: { location?: { lat?: unknown; lng?: unknown } } }>
        }
        const loc = json.results?.[0]?.geometry?.location
        const lat = Number(loc?.lat)
        const lng = Number(loc?.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return { lat, lng }
    } catch {
        return null
    }
}

export async function POST(req: NextRequest) {
    const user = await getCurrentUser(req)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Geocoding API calls cost money past the free tier — modest per-user guard.
    const rateLimit = await checkRateLimit(`resolve-maps-link:${user.id}`, 30, 60_000)
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 })
    }

    const { data, errorResponse } = await parseRequest(req, bodySchema)
    if (errorResponse) return errorResponse
    const { url, address } = data!

    if (url) {
        if (!isAllowedHost(url)) {
            return NextResponse.json({ error: 'Unsupported link host' }, { status: 400 })
        }

        const finalUrl = await resolveRedirect(url)
        if (finalUrl) {
            const coords = parseMapLink(finalUrl)
            if (coords) {
                return NextResponse.json({ lat: coords.lat, lng: coords.lng, source: 'redirect' })
            }
        }
    }

    if (address) {
        const geocoded = await geocodeAddress(address)
        if (geocoded) {
            return NextResponse.json({ lat: geocoded.lat, lng: geocoded.lng, source: 'geocode' })
        }
    }

    return NextResponse.json({ error: 'Could not resolve coordinates from the provided link/address' }, { status: 422 })
}
