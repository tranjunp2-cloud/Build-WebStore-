/**
 * Vercel Domains API client wrapper (server-only).
 *
 * NOTE: This module MUST NOT be imported from client components. The `server-only`
 * npm marker is not currently installed in this repo; we guard at runtime instead
 * by failing fast if `VERCEL_TOKEN` is ever read in a browser bundle. Future work:
 * add the `server-only` package and replace this comment with `import 'server-only'`.
 *
 * Scope: 4 Vercel REST endpoints for project-scoped custom domains.
 *   - addProjectDomain    → POST   /v10/projects/{id}/domains
 *   - verifyProjectDomain → POST   /v9/projects/{id}/domains/{domain}/verify
 *   - getProjectDomain    → GET    /v9/projects/{id}/domains/{domain}
 *   - removeProjectDomain → DELETE /v9/projects/{id}/domains/{domain}
 *
 * All calls are team-scoped via `?teamId=${VERCEL_TEAM_ID}` and authenticated
 * with `Authorization: Bearer ${VERCEL_TOKEN}`.
 *
 * Callers handle retry/back-off — the wrapper is single-shot and surfaces
 * `Retry-After` (seconds) via `VercelDomainsError.retryAfter` for 429 responses.
 */

import {
    VercelDomain,
    VercelDomainsError,
} from './domains.types'

const VERCEL_API_BASE = 'https://api.vercel.com'

interface VercelEnv {
    token: string
    teamId: string
    projectId: string
}

/**
 * Lazy-read required env vars. Throws a descriptive `VercelDomainsError` naming
 * the first missing variable so ops can fix it without grepping the source.
 *
 * Read on every call (not at import time) so test suites can `process.env.VERCEL_TOKEN = …`
 * after the module is imported and have the new value take effect.
 */
export function assertVercelEnv(): VercelEnv {
    const token = process.env.VERCEL_TOKEN
    const teamId = process.env.VERCEL_TEAM_ID
    const projectId = process.env.VERCEL_PROJECT_ID

    if (!token) {
        throw new VercelDomainsError({
            status: 500,
            code: 'missing_env',
            message: 'VERCEL_TOKEN is not set — required to call Vercel Domains API',
        })
    }
    if (!teamId) {
        throw new VercelDomainsError({
            status: 500,
            code: 'missing_env',
            message: 'VERCEL_TEAM_ID is not set — required to scope Vercel Domains API calls',
        })
    }
    if (!projectId) {
        throw new VercelDomainsError({
            status: 500,
            code: 'missing_env',
            message: 'VERCEL_PROJECT_ID is not set — required to target a project for domain ops',
        })
    }

    return { token, teamId, projectId }
}

/**
 * Appends `?teamId=…` (or `&teamId=…`) to a path.
 * Exported for testability — not part of the public API.
 */
function withTeamId(path: string, teamId: string): string {
    const sep = path.includes('?') ? '&' : '?'
    return `${path}${sep}teamId=${encodeURIComponent(teamId)}`
}

/**
 * Internal fetch helper.
 *
 * - Builds full URL including team scoping.
 * - Attaches auth + content-type headers.
 * - On non-2xx: parses Vercel's `{ error: { code, message } }` body (falls back to
 *   statusText if body isn't JSON — e.g. 502 HTML from an upstream proxy).
 * - Captures `Retry-After` header (seconds) on any error response so callers can
 *   decide whether to wait-and-retry or fail-fast.
 * - Generic return type — each wrapper narrows to its expected shape.
 */
async function vercelFetch<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const { token, teamId } = assertVercelEnv()

    const url = `${VERCEL_API_BASE}${withTeamId(path, teamId)}`
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
    }

    let res: Response
    try {
        res = await fetch(url, { ...init, headers })
    } catch (err) {
        // Network-level failure (DNS, connection reset, etc.) — surface as
        // non-retryable error unless caller knows better.
        throw new VercelDomainsError({
            status: 0,
            code: 'network_error',
            message: `Vercel API network error: ${(err as Error).message ?? 'unknown'}`,
        })
    }

    if (res.ok) {
        // DELETE returns `{}`; 204 would have no body. Treat empty body as `{}`.
        if (res.status === 204) {
            return {} as T
        }
        const text = await res.text()
        if (!text) return {} as T
        try {
            return JSON.parse(text) as T
        } catch {
            throw new VercelDomainsError({
                status: res.status,
                code: 'invalid_response',
                message: `Vercel returned non-JSON success body (status ${res.status})`,
            })
        }
    }

    // Error branch — attempt to parse Vercel's structured error body.
    const retryAfterHeader = res.headers.get('Retry-After')
    const retryAfter =
        retryAfterHeader && !Number.isNaN(Number(retryAfterHeader))
            ? Number(retryAfterHeader)
            : undefined

    let code = `http_${res.status}`
    let message = res.statusText || 'Vercel API error'

    try {
        const text = await res.text()
        if (text) {
            const body = JSON.parse(text) as {
                error?: { code?: string; message?: string }
            }
            if (body?.error?.code) code = body.error.code
            if (body?.error?.message) message = body.error.message
        }
    } catch {
        // Non-JSON error body (e.g. 502 HTML from a proxy) — keep statusText fallback.
    }

    throw new VercelDomainsError({
        status: res.status,
        code,
        message,
        retryAfter,
    })
}

/**
 * POST /v10/projects/{projectId}/domains
 *
 * Add a custom domain to the configured Vercel project.
 *
 * Behavior:
 * - If Vercel can immediately verify ownership (e.g. domain already in same team),
 *   returns `{ verified: true }` with no `verification` array.
 * - Otherwise returns `{ verified: false, verification: [{ type: 'TXT', … }] }` —
 *   callers must surface those TXT challenges to the tenant and later invoke
 *   `verifyProjectDomain` after DNS has propagated.
 *
 * Common errors:
 * - `409 domain_already_in_use` — domain is on another Vercel project (possibly
 *   another tenant in this same team). Callers should map to a friendly message.
 * - `400 invalid_domain` — malformed input (should be caught before by input regex).
 */
export async function addProjectDomain(name: string): Promise<VercelDomain> {
    const { projectId } = assertVercelEnv()
    // gitBranch routes the domain to the correct environment's latest deployment.
    // VERCEL_GIT_COMMIT_REF is injected by Vercel at build time ('staging', 'main', etc.).
    // Without this, Vercel defaults to production — causing DEPLOYMENT_NOT_FOUND on staging.
    const gitBranch = process.env.VERCEL_GIT_COMMIT_REF ?? 'main'
    return vercelFetch<VercelDomain>(
        `/v10/projects/${encodeURIComponent(projectId)}/domains`,
        {
            method: 'POST',
            body: JSON.stringify({ name, gitBranch }),
        },
    )
}

/**
 * POST /v9/projects/{projectId}/domains/{domain}/verify
 *
 * Ask Vercel to re-check the TXT challenge for `domain`. Returns the same shape
 * as `addProjectDomain` — `verified: true` on success, or `verified: false` with
 * a fresh `verification[]` if DNS is still wrong.
 *
 * Common errors:
 * - `400 missing_txt_record` / `txt_value_mismatch` — tenant hasn't set the record
 *   or set a stale value. Surface `message` to the user.
 */
export async function verifyProjectDomain(domain: string): Promise<VercelDomain> {
    const { projectId } = assertVercelEnv()
    return vercelFetch<VercelDomain>(
        `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}/verify`,
        { method: 'POST' },
    )
}

/**
 * GET /v9/projects/{projectId}/domains/{domain}
 *
 * Read current verification/SSL state for `domain`. Used by the dashboard
 * "refresh status" flow and by the backfill script.
 *
 * There is no explicit `ssl: ready|pending|error` field — we treat
 * `verified === true && (verification ?? []).length === 0` as "ready".
 */
export async function getProjectDomain(domain: string): Promise<VercelDomain> {
    const { projectId } = assertVercelEnv()
    return vercelFetch<VercelDomain>(
        `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`,
        { method: 'GET' },
    )
}

/**
 * DELETE /v9/projects/{projectId}/domains/{domain}
 *
 * Unbind `domain` from the configured Vercel project. Does NOT delete the
 * underlying domain registration (tenants own their own DNS).
 *
 * @param opts.removeRedirects - also remove any domains redirecting to this one.
 *
 * Callers typically catch 404 (already removed) and swallow — idempotent delete.
 */
export async function removeProjectDomain(
    domain: string,
    opts: { removeRedirects?: boolean } = {},
): Promise<void> {
    const { projectId } = assertVercelEnv()
    const body =
        opts.removeRedirects !== undefined
            ? JSON.stringify({ removeRedirects: opts.removeRedirects })
            : undefined
    await vercelFetch<Record<string, never>>(
        `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`,
        {
            method: 'DELETE',
            ...(body ? { body } : {}),
        },
    )
}
