const DASHBOARD_FIXTURE_CAPABILITY = 'dashboard-fixture-v2'
const DASHBOARD_FIXTURE_ORDER_PREFIX = 'E2E-DASHBOARD-PENDING-'
const DASHBOARD_FIXTURE_TOTAL = 107.8

export interface DashboardFixture {
    orderId: string
    orderNumber: string
    orderTotal: number
}

function requiredEnv(name: 'BASE_URL' | 'E2E_SETUP_SECRET' | 'TEST_EMAIL' | 'TEST_PASSWORD') {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is required to provision the dashboard fixture`)
    return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

/** Recreate the isolated dashboard order at the start of every Playwright attempt. */
export async function provisionDashboardFixture(): Promise<DashboardFixture> {
    const baseUrl = requiredEnv('BASE_URL')
    const setupSecret = requiredEnv('E2E_SETUP_SECRET')
    const email = requiredEnv('TEST_EMAIL')
    const password = requiredEnv('TEST_PASSWORD')

    const response = await fetch(new URL('/api/e2e/ensure-test-user', baseUrl), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${setupSecret}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            password,
            seedDashboardFixture: true,
        }),
    })
    const responseText = await response.text()

    if (!response.ok) {
        throw new Error(
            `Dashboard fixture provisioning failed (${response.status}): ${responseText}`,
        )
    }

    let responseBody: unknown
    try {
        responseBody = JSON.parse(responseText)
    } catch {
        throw new Error('Dashboard fixture provisioning returned invalid JSON')
    }

    if (
        !isRecord(responseBody)
        || responseBody.setupCapability !== DASHBOARD_FIXTURE_CAPABILITY
        || !isRecord(responseBody.dashboardFixture)
    ) {
        throw new Error('Dashboard fixture provisioning returned an incompatible capability')
    }

    const { orderId, orderNumber, orderTotal } = responseBody.dashboardFixture
    if (
        (typeof orderId !== 'string' && typeof orderId !== 'number')
        || typeof orderNumber !== 'string'
        || !orderNumber.startsWith(DASHBOARD_FIXTURE_ORDER_PREFIX)
        || orderTotal !== DASHBOARD_FIXTURE_TOTAL
    ) {
        throw new Error('Dashboard fixture provisioning returned an invalid fixture')
    }

    return {
        orderId: String(orderId),
        orderNumber,
        orderTotal,
    }
}
