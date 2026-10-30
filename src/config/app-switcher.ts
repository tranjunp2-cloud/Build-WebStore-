/**
 * App Switcher (⊞) launcher config — F18 #1138 phase-03, UI-only.
 *
 * Static list of ecosystem apps shown in the header's 9-dot dropdown. Each entry is a
 * DIRECT link (no SSO handshake implemented yet). When the real SSO/workspace API ships,
 * swap the source HERE — the AppSwitcher component only consumes this array.
 */
export interface SwitcherApp {
    id: string
    name: string
    /** Direct link target (SSO URL of the app once SSO exists). */
    url: string
    /** The app the user is currently in — rendered highlighted, not clickable. */
    current?: boolean
    /** Identity dot color shown next to the app name. */
    colorDot?: string
}

export const APP_SWITCHER_APPS: SwitcherApp[] = [
    { id: 'web-store', name: 'Web Store', url: '/dashboard', current: true, colorDot: '#06B6D4' },
    // Other ecosystem apps land here once their SSO URLs exist (UI-only for now).
]

/**
 * Target for the dropdown footer "Secure SSO redirect" link — differs per environment.
 * Resolved from NEXT_PUBLIC_APP_ENV (set per Vercel environment: staging vs production),
 * mirroring how the rest of F18 reads the deploy env. Placeholder URLs until the real SSO
 * portal exists — swap the values below when SSO ships. Local/dev falls back to /dashboard.
 */
const SSO_PORTAL_URL_BY_ENV: Record<string, string> = {
    production: 'https://sso.ecommercehub.unifi.com.my/', // production SSO portal
    staging: 'https://sso.dev.ecommercehub.my/', // staging SSO portal
    development: 'https://sso.dev.ecommercehub.my/', // local dev → hit staging SSO to test the flow
}

function withTrailingSlash(url: string): string {
    return url.endsWith('/') ? url : `${url}/`
}

// Fallback to the PRODUCTION portal: a misconfigured/missing env in a prod build must never
// silently route real users to the staging SSO. Local/staging always set NEXT_PUBLIC_APP_ENV.
// NEXT_PUBLIC_SSO_BASE_URL (also used by account settings) overrides the per-env table when set.
export const SSO_PORTAL_URL = withTrailingSlash(
    process.env.NEXT_PUBLIC_SSO_BASE_URL?.trim() ||
        (SSO_PORTAL_URL_BY_ENV[process.env.NEXT_PUBLIC_APP_ENV ?? ''] ?? SSO_PORTAL_URL_BY_ENV.production),
)
