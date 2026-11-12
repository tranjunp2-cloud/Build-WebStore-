/**
 * Same-origin check for state-changing requests to the /api/ai/* routes: the Origin (else Referer)
 * host must be this host. A request with neither header is a non-browser client and is let through;
 * the session cookie still has to be valid.
 */
export function validateCsrf(req: Pick<Request, 'headers'>, options: { requireOrigin?: boolean } = {}): boolean {
    const host = req.headers.get('host')
    const origin = req.headers.get('origin')
    if (!origin) {
        const referer = req.headers.get('referer')
        if (!referer) return !options.requireOrigin
        try {
            return Boolean(host && new URL(referer).host === host)
        } catch {
            return false
        }
    }
    try {
        return Boolean(host && new URL(origin).host === host)
    } catch {
        return false
    }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * A state-changing request authenticated by the session COOKIE must prove it comes from this site: same-host Origin
 * (else Referer), and neither header missing — a browser always sends one on a cross-site POST, so "none" is either
 * a non-browser client (which should use `Authorization: Bearer`) or a stripped request (TC-PERF-162). Requests with
 * an Authorization token, and safe methods, are not affected; webhooks do not use the session at all.
 */
export function cookieSessionAllowed(req: Pick<Request, 'headers' | 'method'>): boolean {
    if (SAFE_METHODS.has((req.method || 'GET').toUpperCase())) return true
    return validateCsrf(req, { requireOrigin: true })
}
