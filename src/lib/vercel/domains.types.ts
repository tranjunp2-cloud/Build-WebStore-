/**
 * Vercel Domains API — type definitions
 *
 * Response shape for project-domain endpoints used by F19 custom domain flow.
 * Types mirror the documented fields from:
 *   - POST   /v10/projects/{idOrName}/domains
 *   - POST   /v9/projects/{idOrName}/domains/{domain}/verify
 *   - GET    /v9/projects/{idOrName}/domains/{domain}
 *   - DELETE /v9/projects/{idOrName}/domains/{domain}
 *
 * Fields beyond what we consume are intentionally omitted — Vercel may add
 * undocumented fields at any time; we only destructure what we rely on.
 */

export interface VercelDomainVerification {
    type: 'TXT'
    domain: string
    value: string
    reason: string
}

export interface VercelDomain {
    name: string
    apexName: string
    projectId: string
    verified: boolean
    /** Present when `verified === false`. Each entry describes a challenge the tenant must satisfy. */
    verification?: VercelDomainVerification[]
    createdAt: number
    updatedAt: number
}

export interface VercelDomainsErrorArgs {
    status: number
    code: string
    message: string
    retryAfter?: number
}

/**
 * Error thrown by the Vercel domains wrapper on any non-2xx response.
 *
 * - `status`     — HTTP status code
 * - `code`       — Vercel error code from response body (`error.code`), or a synthetic
 *                  fallback (`http_{status}`, `invalid_response`, `network_error`)
 * - `message`    — Human-readable message; safe to log but DO NOT expose to clients
 *                  without scrubbing if the wrapper is ever called with user-supplied
 *                  secrets in the URL (currently not the case).
 * - `retryAfter` — Parsed from `Retry-After` header on 429 responses (seconds).
 */
export class VercelDomainsError extends Error {
    public readonly status: number
    public readonly code: string
    public readonly retryAfter?: number

    constructor(args: VercelDomainsErrorArgs) {
        super(args.message)
        this.name = 'VercelDomainsError'
        this.status = args.status
        this.code = args.code
        this.retryAfter = args.retryAfter
        // Preserve prototype chain for `instanceof` checks across transpilation targets.
        Object.setPrototypeOf(this, VercelDomainsError.prototype)
    }
}
