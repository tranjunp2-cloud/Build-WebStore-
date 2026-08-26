import 'server-only'

import type {
    LiveError,
    LiveErrorSource,
} from './contracts'
import { LiveErrorProviderError } from './contracts'
import { fetchSentryErrors } from './providers/sentry'
import { fetchVercelErrors } from './providers/vercel'
import { resolveTenant } from './resolve-tenant'

const TENANT_LOOKUP_BUDGET_MS = 1_000
const TENANT_LOOKUP_CONCURRENCY = 4

async function resolveTenantWithin(
    host: string,
    timeoutMs: number,
): Promise<LiveError['tenantMatch']> {
    return new Promise(resolve => {
        const timeout = setTimeout(() => resolve(null), timeoutMs)
        void resolveTenant(host)
            .then(match => {
                clearTimeout(timeout)
                resolve(match)
            })
            .catch(() => {
                clearTimeout(timeout)
                resolve(null)
            })
    })
}

export type ProviderEvidenceResponse = {
    data: LiveError[] | LiveError
    fetchedAt: string
}

async function addTenantMatches(errors: LiveError[]): Promise<LiveError[]> {
    const hosts = [...new Set(
        errors.map(error => error.host).filter((host): host is string => Boolean(host)),
    )]
    const matches = new Map<string, LiveError['tenantMatch']>()
    const deadline = Date.now() + TENANT_LOOKUP_BUDGET_MS
    let nextHost = 0

    async function worker() {
        while (nextHost < hosts.length && Date.now() < deadline) {
            const host = hosts[nextHost]
            nextHost += 1
            const remaining = Math.max(1, deadline - Date.now())
            const match = await resolveTenantWithin(host, remaining)
            matches.set(host, match)
        }
    }

    await Promise.all(
        Array.from(
            { length: Math.min(TENANT_LOOKUP_CONCURRENCY, hosts.length) },
            () => worker(),
        ),
    )

    return errors.map(error => ({
        ...error,
        tenantMatch: error.host ? matches.get(error.host) ?? null : null,
    }))
}

/**
 * Refetches provider evidence by provider-owned identity. Callers must perform
 * their own authorization before invoking this server-only function.
 */
export async function fetchProviderEvidence(
    source: LiveErrorSource,
    providerId?: string,
): Promise<ProviderEvidenceResponse> {
    if (source === 'vercel' && providerId) {
        // Runtime Logs is a transient stream. Reopening it cannot prove that a
        // previously selected content hash is the same provider-owned event.
        throw new LiveErrorProviderError('vercel', 'unavailable')
    }

    const result = source === 'sentry'
        ? await fetchSentryErrors(providerId)
        : await fetchVercelErrors(providerId)
    const data = await addTenantMatches(result.data)

    if (!providerId) return { data, fetchedAt: result.fetchedAt }
    if (!data[0]) throw new LiveErrorProviderError(source, 'not-found')
    return { data: data[0], fetchedAt: result.fetchedAt }
}
