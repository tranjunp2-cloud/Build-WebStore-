/** F37 US-01: Geocoding — Paste Google Maps Link → lat/lng (PRD §13.9, layer 1).
 *
 * Pure, dependency-free, unit-testable parser: extracts a pin's coordinates
 * directly from a full (non-shortened) Google Maps URL. No network access —
 * shortened links (`maps.app.goo.gl/*`, `goo.gl/maps/*`) carry no coordinates
 * and must go through the server redirect-resolver (layer 2, see
 * `src/app/api/local-seo/resolve-maps-link/route.ts`) before being re-parsed
 * with this same regex.
 */

export interface LatLng {
    lat: number
    lng: number
}

/** Pin marker coordinates, e.g. `...!8m2!3d3.1469!4d101.6955!16s...` — this is
 *  Google's own encoding of the exact pinned location, preferred over the
 *  viewport-centre `@lat,lng` pattern below (§13.9: "Tin `!3d!4d` hơn `@`"). */
const PIN_COORDS_REGEX = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/

/** Viewport-centre coordinates, e.g. `.../@3.1469,101.6955,17z/...` — may be
 *  the map's pan/zoom centre rather than the actual pin, so only used when
 *  `!3d!4d` is absent from the URL. */
const VIEWPORT_COORDS_REGEX = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/

function isValidLatLng(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng)
        && lat >= -90 && lat <= 90
        && lng >= -180 && lng <= 180
}

/**
 * Extract `{ lat, lng }` from a pasted Google Maps URL using client-side
 * regex only (layer 1). Returns `null` when neither pattern matches (e.g.
 * shortened links) or when matched numbers fall outside valid ranges.
 */
export function parseMapLink(url: string): LatLng | null {
    if (!url || typeof url !== 'string') return null
    const trimmed = url.trim()
    if (!trimmed) return null

    const pinMatch = trimmed.match(PIN_COORDS_REGEX)
    if (pinMatch) {
        const lat = parseFloat(pinMatch[1])
        const lng = parseFloat(pinMatch[2])
        if (isValidLatLng(lat, lng)) return { lat, lng }
    }

    const viewportMatch = trimmed.match(VIEWPORT_COORDS_REGEX)
    if (viewportMatch) {
        const lat = parseFloat(viewportMatch[1])
        const lng = parseFloat(viewportMatch[2])
        if (isValidLatLng(lat, lng)) return { lat, lng }
    }

    return null
}
