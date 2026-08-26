import type { APIRequestContext } from '@playwright/test'

const DASHBOARD_FIXTURE_CAPABILITY = 'dashboard-fixture-v2'
const DASHBOARD_SHIPPING_FIXTURE_CAPABILITY = 'dashboard-shipping-fixture-v2'
const DASHBOARD_SHIPPING_PREREQUISITE_CODES = new Set([
    'TENANT_MISMATCH',
    'EASYPARCEL_NOT_READY',
    'DASHBOARD_NOT_READY',
])

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Idempotent prerequisite preparation for the production-valid, dedicated staging
 * tenant. The endpoint never creates or changes EasyParcel credentials or activation.
 */
interface PrepareOptions {
    maxAttempts?: number
    retryDelayMs?: number
    requestTimeoutMs?: number
}

function isTransientStatus(status: number) {
    // A completed 5xx response is still commit-ambiguous: the transaction may
    // have committed before response serialization or a proxy failure. Only a
    // rate-limit response is safe to replay.
    return status === 429
}

async function wait(delayMs: number) {
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs))
}

export async function prepareDashboardEasyParcelOnlyFixture(
    request: APIRequestContext,
    options: PrepareOptions = {},
): Promise<{ siteIds: string[] }> {
    const maxAttempts = options.maxAttempts ?? 3
    const retryDelayMs = options.retryDelayMs ?? 500
    const requestTimeoutMs = options.requestTimeoutMs ?? 15_000

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let response
        try {
            response = await request.post('/api/e2e/dashboard-fixture', {
                headers: { 'x-e2e-fixture-intent': DASHBOARD_FIXTURE_CAPABILITY },
                data: { action: 'prepare-gh1700-easyparcel-only' },
                timeout: requestTimeoutMs,
            })
        } catch {
            // A client-side timeout or socket failure is commit-ambiguous: the server
            // transaction may still finish. Never enqueue a second mutating request.
            throw new Error('GH-1700 staging prerequisite rejected: network error')
        }

        const responseText = await response.text()
        let body: unknown
        try {
            body = JSON.parse(responseText)
        } catch {
            body = null
        }
        if (!response.ok()) {
            if (isTransientStatus(response.status()) && attempt < maxAttempts) {
                await wait(retryDelayMs)
                continue
            }
            const prerequisiteCode = response.status() === 409
                && isRecord(body)
                && typeof body.code === 'string'
                && DASHBOARD_SHIPPING_PREREQUISITE_CODES.has(body.code)
                ? body.code
                : null
            throw new Error(
                'GH-1700 staging prerequisite rejected (' + response.status() + ')'
                + (prerequisiteCode ? ': ' + prerequisiteCode : ''),
            )
        }
        if (
            !isRecord(body)
            || body.status !== 'shipping-state-ready'
            || body.shippingSetupCapability !== DASHBOARD_SHIPPING_FIXTURE_CAPABILITY
            || !Array.isArray(body.siteIds)
            || body.siteIds.length < 1
            || body.siteIds.some(siteId => typeof siteId !== 'string' || !siteId)
            || new Set(body.siteIds).size !== body.siteIds.length
        ) {
            throw new Error(
                'GH-1700 staging prerequisite rejected (' + response.status()
                + '): invalid response contract',
            )
        }
        return { siteIds: body.siteIds as string[] }
    }

    throw new Error('GH-1700 staging prerequisite rejected: retry limit exhausted')
}
