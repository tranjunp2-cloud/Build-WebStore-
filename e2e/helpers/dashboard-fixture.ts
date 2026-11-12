import type { APIRequestContext } from '@playwright/test'

const DASHBOARD_FIXTURE_CAPABILITY = 'dashboard-fixture-v2'
const DASHBOARD_FIXTURE_ORDER_PREFIX = 'E2E-DASHBOARD-PENDING-'
const DASHBOARD_FIXTURE_TOTAL = 107.8
const DEFAULT_MAX_ATTEMPTS = 25
const DEFAULT_RETRY_DELAY_MS = 5_000
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000
const DEFAULT_READINESS_TIMEOUT_MS = 120_000

export interface DashboardFixture {
    orderId: string
    orderNumber: string
    orderTotal: number
    tenantSlug?: string
}

interface ProvisionOptions {
    maxAttempts?: number
    retryDelayMs?: number
    requestTimeoutMs?: number
    readinessTimeoutMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function readFixture(responseBody: unknown): DashboardFixture | null {
    if (
        !isRecord(responseBody)
        || responseBody.setupCapability !== DASHBOARD_FIXTURE_CAPABILITY
        || !isRecord(responseBody.dashboardFixture)
    ) {
        return null
    }

    const { orderId, orderNumber, orderTotal } = responseBody.dashboardFixture
    if (
        (typeof orderId !== 'string' && typeof orderId !== 'number')
        || typeof orderNumber !== 'string'
        || !orderNumber.startsWith(DASHBOARD_FIXTURE_ORDER_PREFIX)
        || orderTotal !== DASHBOARD_FIXTURE_TOTAL
    ) {
        return null
    }

    return {
        orderId: String(orderId),
        orderNumber,
        orderTotal,
        ...(typeof responseBody.tenantSlug === 'string' ? { tenantSlug: responseBody.tenantSlug } : {}),
    }
}

function isTransientStatus(status: number) {
    return status === 404
        || status === 429
        || status === 500
        || status === 502
        || status === 503
        || status === 504
}

async function wait(delayMs: number) {
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs))
}

/**
 * Recreate the isolated dashboard order through the authenticated Playwright
 * session. Retrying here also gates TC-F03.57 on the deployed v2 contract.
 */
export async function provisionDashboardFixture(
    request: APIRequestContext,
    options: ProvisionOptions = {},
): Promise<DashboardFixture> {
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    const readinessTimeoutMs = options.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS
    const readinessDeadline = Date.now() + readinessTimeoutMs
    let lastFailure = 'incompatible capability'

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const remainingMs = readinessDeadline - Date.now()
        if (remainingMs <= 0) break

        let response
        try {
            response = await request.post('/api/e2e/dashboard-fixture', {
                headers: {
                    'x-e2e-fixture-intent': DASHBOARD_FIXTURE_CAPABILITY,
                },
                timeout: Math.max(1, Math.min(requestTimeoutMs, remainingMs)),
            })
        } catch (error: unknown) {
            lastFailure = error instanceof Error ? error.message : 'network error'
            if (attempt < maxAttempts) {
                await wait(Math.min(retryDelayMs, Math.max(0, readinessDeadline - Date.now())))
            }
            continue
        }

        const status = response.status()
        if (!response.ok()) {
            if (!isTransientStatus(status)) {
                throw new Error(`Dashboard fixture provisioning rejected (${status})`)
            }
            lastFailure = `transient HTTP ${status}`
        } else {
            const responseText = await response.text()
            let responseBody: unknown
            try {
                responseBody = JSON.parse(responseText)
            } catch {
                responseBody = null
            }
            const fixture = readFixture(responseBody)
            if (fixture) return fixture
            lastFailure = 'incompatible capability or invalid fixture'
        }

        if (attempt < maxAttempts) {
            await wait(Math.min(retryDelayMs, Math.max(0, readinessDeadline - Date.now())))
        }
    }

    throw new Error(
        `Dashboard fixture provisioning did not become ready: ${lastFailure}`,
    )
}
