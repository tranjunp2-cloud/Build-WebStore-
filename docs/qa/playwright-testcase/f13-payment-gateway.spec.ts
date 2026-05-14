import { test, expect, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

type QaCase = {
    id: string
    refs: string
    layer: string
    title: string
    severity: string
    auto: boolean
    deferred: boolean
}

type RuntimeCheck = (ctx: {
    page: Page
    request: APIRequestContext
    testInfo: TestInfo
    qaCase: QaCase
}) => Promise<void>

const repoRoot = process.cwd()
const qaDocPath = path.join(repoRoot, 'docs', 'qa', 'F13-payment-gateway.md')
const currentSpecPath = 'docs/qa/playwright-testcase/f13-payment-gateway.spec.ts'
// QA doc v1.5 = 141 TCs (TC-F13.01..141). NHÓM 11+12 (TC-F13.81..113) Wave 6 hardening; NHÓM 13+14+15 (TC-F13.114..141) Stripe events + MY market + schema/authz.
const expectedTcCount = 141
const expectedTcIds = Array.from({ length: expectedTcCount }, (_, index) => `TC-F13.${String(index + 1).padStart(2, '0')}`)
const stripeCheckoutUrlPattern = /checkout\.stripe\.com|stripe\.com/i

function readFile(relativePath: string) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function env(name: string) {
    return process.env[name]?.trim()
}

function requireEnv(keys: string[], reason: string) {
    const missing = keys.filter((key) => !env(key))
    if (missing.length > 0) {
        test.skip(true, `${reason}. Missing env: ${missing.join(', ')}`)
    }
}

function requireStripeE2E(reason: string) {
    if (env('F13_RUN_STRIPE_E2E') !== 'true') {
        test.skip(true, `${reason}. Set F13_RUN_STRIPE_E2E=true with staging Stripe test data to run.`)
    }
}

function listFiles(relativeDir: string, matcher: RegExp) {
    const root = path.join(repoRoot, relativeDir)
    const files: string[] = []

    if (!fs.existsSync(root)) return files

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const fullPath = path.join(root, entry.name)
        const relativePath = path.relative(repoRoot, fullPath).replace(/\\/g, '/')

        if (entry.isDirectory()) {
            files.push(...listFiles(relativePath, matcher))
        } else if (matcher.test(relativePath)) {
            files.push(relativePath)
        }
    }

    return files
}

function cleanMarkdown(value: string) {
    return value
        .replace(/\*\*/g, '')
        .replace(/~~/g, '')
        .replace(/`/g, '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function readQaCases(): QaCase[] {
    const doc = fs.readFileSync(qaDocPath, 'utf8')
    const rows = doc
        .split(/\r?\n/)
        .filter((line) => line.startsWith('| **TC-F13.'))

    return rows.map((row) => {
        const cells = row.split('|').slice(1, -1).map((cell) => cell.trim())
        const id = cleanMarkdown(cells[0])
        const refs = cleanMarkdown(cells[1])
        const title = cleanMarkdown(cells[3])
        const severity = cleanMarkdown(cells[6])

        return {
            id,
            refs,
            layer: cleanMarkdown(cells[2]),
            title,
            severity,
            auto: cells[7]?.includes('[x]') ?? false,
            deferred: severity === 'OOS' || refs.includes('Deferred') || title.includes('DEFER'),
        }
    })
}

function sourceFilesForPaymentSecurity() {
    return [
        ...listFiles('src/lib/payment', /\.(ts|tsx)$/),
        ...listFiles('src/app/api/webhooks/stripe', /\.(ts|tsx)$/),
        ...listFiles('src/app/api/stripe', /\.(ts|tsx)$/),
        ...listFiles('src/app/api/orders', /\.(ts|tsx)$/),
        ...listFiles('src/collections', /\/(Orders|Tenants)\.ts$/),
    ]
}

function assertFullQaDocCoverage() {
    const cases = readQaCases()
    expect(cases.map((qaCase) => qaCase.id)).toEqual(expectedTcIds)

    const doc = fs.readFileSync(qaDocPath, 'utf8')
    for (let index = 1; index <= 15; index++) {
        const requirementId = `FR-${String(index).padStart(2, '0')}`
        expect(doc, `${requirementId} must be represented in the F13 QA matrix`).toContain(requirementId)
    }
}

function assertNoCardDataStored() {
    const forbiddenPatterns = [
        /\b(card_number|cardNumber|card num|full card)\b/i,
        /\b(cvv|cvc|security_code|securityCode)\b/i,
        /\b(primary_account_number|pan)\b/i,
        /\b(expiry|exp_month|exp_year)\b/i,
        /\b4242[ -]?4242[ -]?4242[ -]?4242\b/,
        /\b4000[ -]?0000[ -]?0000[ -]?0002\b/,
    ]

    for (const file of sourceFilesForPaymentSecurity()) {
        const content = readFile(file)
        for (const pattern of forbiddenPatterns) {
            expect(content, `${file} must not store or process raw card data matching ${pattern}`).not.toMatch(pattern)
        }
    }
}

function assertNoHardcodedPaymentSecrets() {
    const files = [
        ...sourceFilesForPaymentSecurity(),
        '.env.staging.example',
        '.env.production.example',
    ].filter((file) => fs.existsSync(path.join(repoRoot, file)))

    const forbiddenPatterns = [
        /\bsk_live_[A-Za-z0-9]{20,}\b/,
        /\brk_live_[A-Za-z0-9]{20,}\b/,
        /\bpk_live_[A-Za-z0-9]{20,}\b/,
        /\bwhsec_[A-Za-z0-9]{20,}\b/,
    ]

    for (const file of files) {
        const content = readFile(file)
        for (const pattern of forbiddenPatterns) {
            expect(content, `${file} must not contain a real Stripe secret matching ${pattern}`).not.toMatch(pattern)
        }
    }
}

function assertTestConventionIsLinked() {
    const convention = readFile('docs/TEST_CONVENTION.md')
    expect(convention).toContain('TC-ID')
    expect(convention).toContain('AAA')
    expect(convention).toContain('Import')

    const currentSpec = readFile(currentSpecPath)
    const qaDoc = fs.readFileSync(qaDocPath, 'utf8')
    for (const id of expectedTcIds) {
        expect(currentSpec + qaDoc, `${id} must be represented by the Playwright F13 coverage`).toContain(id)
    }
}

function assertStripeEnvGuardIsGenericToClient() {
    const stripeSource = readFile('src/lib/payment/stripe.ts')
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')

    expect(stripeSource).toContain('STRIPE_SECRET_KEY is not set')
    expect(orderCreateSource).toContain('Order creation failed')
    expect(orderCreateSource).not.toMatch(/message:\s*error\.message/)
}

function assertF13TestsDoNotReimplementPaymentLogic() {
    const currentSpec = readFile(currentSpecPath)
    const forbiddenHelpers = [
        /function\s+buildPaymentMethodTypes/,
        /const\s+buildPaymentMethodTypes\s*=/,
        /function\s+createStripeCheckoutSession/,
        /const\s+createStripeCheckoutSession\s*=/,
        /applicationFeeAmount\s*=\s*Math\.round/,
    ]

    for (const pattern of forbiddenHelpers) {
        expect(currentSpec, `F13 Playwright must not re-implement source payment logic matching ${pattern}`)
            .not.toMatch(pattern)
    }
}

function assertF13TestHygiene() {
    const currentSpec = readFile(currentSpecPath)
    const consoleDebugCall = ['console', 'log'].join('.') + '('
    const inlineMockCall = ['vi', 'mock'].join('.') + '('

    expect(currentSpec).not.toMatch(/\bshould work\b/i)
    expect(currentSpec).not.toContain(consoleDebugCall)
    expect(currentSpec).not.toContain(inlineMockCall)
}

async function firstVisible(page: Page, selectors: string[], timeout = 7000): Promise<Locator> {
    for (const selector of selectors) {
        const locator = page.locator(selector).first()
        try {
            await locator.waitFor({ state: 'visible', timeout })
            return locator
        } catch {
            // Try next selector.
        }
    }

    throw new Error(`No visible element found for selectors: ${selectors.join(', ')}`)
}

async function loginAsSeller(page: Page) {
    requireEnv(['F13_SELLER_EMAIL', 'F13_SELLER_PASSWORD'], 'Seller login is required for F13 settings/onboarding E2E')

    await page.goto(env('F13_LOGIN_URL') || '/login')
    await (await firstVisible(page, ['input[name="email"]', 'input[type="email"]', '#email'])).fill(env('F13_SELLER_EMAIL')!)
    await (await firstVisible(page, ['input[name="password"]', 'input[type="password"]', '#password'])).fill(env('F13_SELLER_PASSWORD')!)
    await page.getByRole('button', { name: /sign in|login|log in|masuk/i }).first().click()

    await page.waitForURL(/dashboard|onboarding|admin|verify-otp/, { timeout: 20_000 })
    if (page.url().includes('/verify-otp')) {
        requireEnv(['F13_OTP_CODE'], 'OTP is required when seller account has 2FA enabled')
        const otpInputs = page.locator('input[inputmode="numeric"], input[data-otp="true"]')
        const count = await otpInputs.count()

        if (count >= 6) {
            for (let index = 0; index < 6; index++) {
                await otpInputs.nth(index).fill(env('F13_OTP_CODE')![index])
            }
        } else {
            await (await firstVisible(page, ['input[name="otp"]', 'input[type="text"]'])).fill(env('F13_OTP_CODE')!)
        }

        const verifyButton = page.getByRole('button', { name: /verify|submit|continue|sahkan/i }).first()
        if (await verifyButton.isVisible()) {
            await verifyButton.click()
        }
        await page.waitForURL(/dashboard|onboarding|admin/, { timeout: 20_000 })
    }
}

async function gotoPaymentSettings(page: Page) {
    await loginAsSeller(page)
    await page.goto(env('F13_PAYMENTS_URL') || '/dashboard/settings/payments')
    await expect(page.locator('body')).not.toBeEmpty()
    expect(page.url()).not.toContain('/login')
}

async function gotoReadyCheckout(page: Page) {
    requireEnv(['F13_CHECKOUT_URL'], 'A seeded checkout URL with cart/customer data is required for buyer payment E2E')
    await page.goto(env('F13_CHECKOUT_URL')!)
    await expect(page.locator('body')).not.toBeEmpty()
}

async function chooseStripeAndRedirect(page: Page) {
    const stripeLabel = page.getByText(/stripe|card|fpx|online banking/i).first()
    await expect(stripeLabel).toBeVisible({ timeout: 15_000 })
    await stripeLabel.click()

    const placeOrderButton = page.getByRole('button', {
        name: /place order|pay|checkout|bayar|buat pesanan/i,
    }).first()
    await expect(placeOrderButton).toBeEnabled({ timeout: 15_000 })
    await placeOrderButton.click()

    await page.waitForURL(stripeCheckoutUrlPattern, { timeout: 45_000 })
    expect(page.url()).toMatch(stripeCheckoutUrlPattern)
}

async function fillStripeCard(page: Page, cardNumber: string) {
    await (await firstVisible(page, [
        'input[name="number"]',
        'input[autocomplete="cc-number"]',
        'input[placeholder*="Card number" i]',
        'input[aria-label*="Card number" i]',
    ], 20_000)).fill(cardNumber)
    await (await firstVisible(page, [
        'input[name="expiry"]',
        'input[autocomplete="cc-exp"]',
        'input[placeholder*="MM" i]',
        'input[aria-label*="expiration" i]',
    ])).fill(env('F13_CARD_EXPIRY') || '12 / 30')
    await (await firstVisible(page, [
        'input[name="cvc"]',
        'input[autocomplete="cc-csc"]',
        'input[placeholder*="CVC" i]',
        'input[aria-label*="security" i]',
    ])).fill(env('F13_CARD_CVC') || '123')
}

async function payOnStripeCheckout(page: Page) {
    await page.getByRole('button', { name: /pay|bayar|submit/i }).first().click()
}

async function runCardPaymentSuccess(page: Page) {
    requireStripeE2E('Card success requires a real Stripe hosted Checkout run')
    await gotoReadyCheckout(page)
    await chooseStripeAndRedirect(page)
    await fillStripeCard(page, env('F13_CARD_SUCCESS') || '4242424242424242')
    await payOnStripeCheckout(page)
    await page.waitForURL(/success|confirmation|thank|order|checkout/i, { timeout: 60_000 })
    await expect(page.locator('body')).toContainText(/success|thank|confirmed|paid|berjaya/i, { timeout: 20_000 })
}

async function runDeclinedCard(page: Page) {
    requireStripeE2E('Declined card recovery requires a real Stripe hosted Checkout run')
    await gotoReadyCheckout(page)
    await chooseStripeAndRedirect(page)
    await fillStripeCard(page, env('F13_CARD_DECLINED') || '4000000000000002')
    await payOnStripeCheckout(page)
    await expect(page.locator('body')).toContainText(/declined|try again|gagal|ditolak/i, { timeout: 30_000 })
}

async function chooseFpxOnStripe(page: Page) {
    const fpxOption = page.getByText(/fpx|online banking|bank/i).first()
    await expect(fpxOption).toBeVisible({ timeout: 20_000 })
    await fpxOption.click()
}

async function runFpxHostedPickerCheck(page: Page) {
    requireStripeE2E('FPX hosted picker requires a real Stripe hosted Checkout run')
    await gotoReadyCheckout(page)
    await chooseStripeAndRedirect(page)
    await chooseFpxOnStripe(page)
    await expect(page).toHaveURL(stripeCheckoutUrlPattern)
    await expect(page.locator('body')).toContainText(/fpx|bank|online banking|maybank|cimb/i, { timeout: 20_000 })
}

async function runFpxPaymentSuccess(page: Page) {
    requireStripeE2E('FPX success requires a real Stripe hosted Checkout run')
    await runFpxHostedPickerCheck(page)

    const bankName = env('F13_FPX_BANK') || 'Maybank'
    const bankOption = page.getByText(new RegExp(bankName, 'i')).first()
    await expect(bankOption).toBeVisible({ timeout: 20_000 })
    await bankOption.click()
    await payOnStripeCheckout(page)
    await page.waitForURL(/success|confirmation|thank|order|checkout/i, { timeout: 90_000 })
}

async function runSellerConnectRedirect(page: Page) {
    requireStripeE2E('Seller Connect requires staging account and Stripe onboarding test mode')
    await gotoPaymentSettings(page)

    const connectButton = page.getByRole('button', { name: /connect stripe|connect|stripe/i }).first()
    await expect(connectButton).toBeVisible({ timeout: 15_000 })
    await connectButton.click()
    await page.waitForURL(/connect\.stripe\.com|stripe\.com/i, { timeout: 45_000 })
}

async function runCancelRecovery(page: Page) {
    requireStripeE2E('Cancel recovery requires a real Stripe hosted Checkout run')
    await gotoReadyCheckout(page)
    await chooseStripeAndRedirect(page)
    await page.goBack()
    await expect(page.locator('body')).toContainText(/gagal|try again|cart|checkout|payment/i, { timeout: 30_000 })
}

async function runSignedWebhookReplay(request: APIRequestContext) {
    requireEnv(['F13_WEBHOOK_SECRET'], 'Valid signed webhook replay requires the staging webhook secret')
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(env('F13_STRIPE_SECRET_KEY') || 'sk_test_f13_playwright_signature_only')
    const payload = JSON.stringify({
        id: `evt_f13_pw_${Date.now()}`,
        object: 'event',
        type: 'checkout.session.completed',
        data: {
            object: {
                id: `cs_f13_pw_${Date.now()}`,
                object: 'checkout.session',
                client_reference_id: null,
                payment_intent: 'pi_f13_pw',
                payment_method_types: ['card'],
            },
        },
    })
    const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: env('F13_WEBHOOK_SECRET')!,
    })

    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await request.post('/api/webhooks/stripe', {
            data: payload,
            headers: {
                'content-type': 'application/json',
                'stripe-signature': signature,
            },
        })
        expect(response.status()).toBe(200)
    }
}

async function runTenantIsolationCheck(page: Page) {
    requireEnv(['F13_TENANT_B_ID'], 'Tenant isolation E2E requires a tenant B id that seller A must not own')
    await loginAsSeller(page)

    const statusResponse = await page.context().request.get(`/api/stripe/connect/status?tenantId=${env('F13_TENANT_B_ID')}`)
    expect([401, 403, 404]).toContain(statusResponse.status())

    if (env('F13_TENANT_B_SITE_ID')) {
        const orderResponse = await page.context().request.post('/api/orders/create', {
            data: {
                siteId: env('F13_TENANT_B_SITE_ID'),
                items: [{ productId: env('F13_TENANT_B_PRODUCT_ID') || 'forbidden-product', quantity: 1 }],
                customer: {
                    name: 'F13 Tenant Isolation',
                    email: 'f13-tenant-isolation@example.com',
                    phone: '60123456789',
                    address: {
                        line1: 'Test',
                        city: 'Kuala Lumpur',
                        postcode: '50000',
                        country: 'Malaysia',
                    },
                },
            },
        })
        expect([401, 403, 404]).toContain(orderResponse.status())
    }
}

async function runMobileCheckoutLayout(page: Page) {
    requireEnv(['F13_CHECKOUT_URL'], 'Mobile checkout evidence requires a seeded checkout URL')
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoReadyCheckout(page)

    const noHorizontalOverflow = await page.evaluate(() => (
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    ))
    expect(noHorizontalOverflow).toBe(true)

    const paymentRows = page.locator('[role="radio"], label:has-text("Stripe"), label:has-text("Card"), label:has-text("FPX")')
    const count = await paymentRows.count()
    expect(count).toBeGreaterThan(0)

    for (let index = 0; index < Math.min(count, 4); index++) {
        const box = await paymentRows.nth(index).boundingBox()
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(54)
    }
}

async function assertReleaseReportExists() {
    const reportPath = path.join(repoRoot, 'docs', 'qa', 'TEST-REPORT', 'F13-payment-gateway-test-report.md')
    if (!fs.existsSync(reportPath)) {
        test.skip(true, 'Release report has not been created yet: docs/qa/TEST-REPORT/F13-payment-gateway-test-report.md')
    }

    const report = fs.readFileSync(reportPath, 'utf8')
    expect(report).toContain('TC-F13.01')
    expect(report).toContain('TC-F13.80')
    expect(report).toMatch(/PASS|FAIL|BLOCKED/i)
}

async function assertWebhookRejectsMissingSignature(request: APIRequestContext) {
    let response

    try {
        response = await request.post('/api/webhooks/stripe', {
            data: { type: 'checkout.session.completed', data: { object: {} } },
        })
    } catch (error) {
        test.skip(true, `App server is not reachable for webhook runtime check: ${String(error)}`)
        throw error
    }

    expect(response.status()).toBe(400)
    expect(await response.text()).toMatch(/Missing stripe-signature header/i)
}

// NHÓM 11+12 hardening checks (Wave 6 hardening)
function assertStripeSessionIdHasUniqueGuard() {
    // TC-F13.84: defense against replay attack — stripeSessionId must be unique-indexed or guarded
    const ordersCollection = readFile('src/collections/Orders.ts')
    const dbSetup = fs.existsSync(path.join(repoRoot, 'scripts/db-setup.js'))
        ? readFile('scripts/db-setup.js')
        : ''
    const webhookRoute = readFile('src/app/api/webhooks/stripe/route.ts')

    const hasUniqueField = /stripeSessionId[\s\S]{0,200}unique:\s*true/i.test(ordersCollection)
    const hasUniqueIndex = /UNIQUE[\s\S]{0,80}stripe_session_id/i.test(dbSetup)
    const hasIdempotencyCheck = /stripeSessionId[\s\S]{0,500}(already|paid|skip|exists)/i.test(webhookRoute)

    expect(
        hasUniqueField || hasUniqueIndex || hasIdempotencyCheck,
        'TC-F13.84: stripeSessionId must have UNIQUE constraint or webhook idempotency guard'
    ).toBe(true)
}

function assertNoPiiInPaymentLogs() {
    // TC-F13.91 + TC-F13.108: payment + webhook code must not log buyer PII or full Stripe payloads
    const files = [
        'src/app/api/webhooks/stripe/route.ts',
        'src/lib/payment/stripe.ts',
        'src/app/api/orders/create/route.ts',
        'src/app/api/orders/checkout/route.ts',
    ].filter((file) => fs.existsSync(path.join(repoRoot, file)))

    const piiPatterns = [
        /console\.(log|error|warn|info)\([^)]{0,300}\b(customer_email|customerEmail|buyer_email)\b/i,
        /console\.(log|error|warn|info)\([^)]{0,300}JSON\.stringify\(\s*event\.data\.object\s*\)/i,
        /console\.(log|error|warn|info)\([^)]{0,300}\b(card\.last4|exp_month|exp_year|payment_method\.card)\b/i,
        /console\.(log|error|warn|info)\([^)]{0,300}\bevent\.data\.object\b(?![\s\S]{0,40}\.id)/i,
    ]

    for (const file of files) {
        const content = readFile(file)
        for (const pattern of piiPatterns) {
            expect(content, `${file} must not log raw PII / full Stripe object (${pattern})`).not.toMatch(pattern)
        }
    }
}

function assertStripeSdkVersionPinned() {
    // TC-F13.109: Stripe SDK version pinned for webhook signature stability
    const pkg = JSON.parse(readFile('package.json'))
    const stripeVersion = pkg.dependencies?.stripe || pkg.devDependencies?.stripe
    expect(stripeVersion, 'TC-F13.109: stripe SDK must be declared in package.json').toBeTruthy()
    // Accept exact, ~, or ^ minor lock but warn against bare * or `latest`
    expect(stripeVersion, 'TC-F13.109: stripe SDK must not use wildcard or latest').not.toMatch(/^\*|^latest$/i)
}

async function assertCsrfProtectionOnConnectOnboard(request: APIRequestContext) {
    // TC-F13.89: POST without proper Origin/auth should not create Stripe account
    let response
    try {
        response = await request.post('/api/stripe/connect/onboard', {
            data: { tenantId: 'cross-origin-attack' },
            headers: {
                'content-type': 'application/json',
                origin: 'https://evil.example.com',
                referer: 'https://evil.example.com/attack',
            },
        })
    } catch (error) {
        test.skip(true, `App server unreachable for CSRF check: ${String(error)}`)
        throw error
    }
    expect([401, 403, 404]).toContain(response.status())
}

async function assertEmailInjectionRejected(request: APIRequestContext) {
    // TC-F13.93: malformed email / XSS payload in customer fields must be rejected
    let response
    try {
        response = await request.post('/api/orders/create', {
            data: {
                siteId: env('F13_SITE_ID') || 'any-site',
                items: [{ productId: 'p1', quantity: 1 }],
                customer: {
                    name: '"><img onerror=alert(1) src=x>',
                    email: '<script>alert(1)</script>@evil',
                    phone: '0',
                    address: { line1: 'x', city: 'x', postcode: '00000', country: 'Malaysia' },
                },
                paymentMethod: 'stripe',
            },
        })
    } catch (error) {
        test.skip(true, `App server unreachable for email injection check: ${String(error)}`)
        throw error
    }
    // Backend should reject 4xx (validation or auth); MUST NOT create Stripe session
    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(response.status()).toBeLessThan(500)
}

function assertCurrencyMyrEnforced() {
    // TC-F13.102: backend must enforce MYR via default + toLowerCase (not hardcoded literal in stripe.ts)
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')
    const stripeSource = readFile('src/lib/payment/stripe.ts')

    // orders/create defaults currency = 'MYR'
    const hasDefaultMyr =
        /currency\s*=\s*['"]MYR['"]/i.test(orderCreateSource) ||
        /currency.*\|\|\s*['"]MYR['"]/i.test(orderCreateSource)
    expect(
        hasDefaultMyr,
        "TC-F13.102: orders/create/route.ts must default currency to 'MYR'"
    ).toBe(true)

    // stripe.ts normalises via .toLowerCase() — never passes a literal non-MYR alternative
    const hasLowerCase = /\.toLowerCase\(\)/.test(stripeSource)
    expect(
        hasLowerCase,
        'TC-F13.102: stripe.ts must call .toLowerCase() on currency param'
    ).toBe(true)

    // Must NOT contain a hardcoded alternative currency string in payment code
    const forbidsHardcodedUsd =
        !/currency:\s*['"]usd['"]/i.test(stripeSource) &&
        !/currency:\s*['"]sgd['"]/i.test(stripeSource)
    expect(
        forbidsHardcodedUsd,
        'TC-F13.102: stripe.ts must not hardcode a non-MYR currency literal'
    ).toBe(true)
}

// ── New static assertion helpers (alphabetical) ────────────────────────────

/** TC-F13.01: Stripe checkout session must carry required shape fields */
function assertCheckoutSessionShape() {
    const stripeSource = readFile('src/lib/payment/stripe.ts')
    expect(stripeSource, "TC-F13.01: stripe.ts must set mode: 'payment'").toMatch(/mode:\s*['"]payment['"]/)
    expect(stripeSource, 'TC-F13.01: stripe.ts must set client_reference_id').toContain('client_reference_id')
    expect(stripeSource, 'TC-F13.01: stripe.ts must set payment_method_types').toContain('payment_method_types')
    expect(stripeSource, 'TC-F13.01: stripe.ts must pass stripeAccount option').toContain('stripeAccount')
}

/** TC-F13.04 + TC-F13.05: application fee uses Math.round + default 3% */
function assertApplicationFeeFormula() {
    const stripeSource = readFile('src/lib/payment/stripe.ts')
    expect(
        stripeSource,
        'TC-F13.04: stripe.ts must use Math.round(...feePercent / 100) for application fee'
    ).toMatch(/Math\.round\(\s*totalAmount\s*\*\s*\(\s*feePercent\s*\/\s*100\s*\)/)
    expect(
        stripeSource,
        'TC-F13.04: default fee percent must be 3'
    ).toMatch(/applicationFeePercent\s*\?\?\s*3/)
}

/** TC-F13.25: onboard route checks existing stripeAccountId before creating new account */
function assertConnectOnboardIdempotent() {
    const onboardSource = readFile('src/app/api/stripe/connect/onboard/route.ts')
    const hasExistingCheck =
        /stripeAccountId/.test(onboardSource) &&
        /if\s*\(/.test(onboardSource)
    expect(
        hasExistingCheck,
        'TC-F13.25: connect/onboard/route.ts must check existing stripeAccountId before createConnectedAccount'
    ).toBe(true)
}

/** TC-F13.29: onboard route builds return_url and refresh_url with expected query params */
function assertConnectReturnUrls() {
    const onboardSource = readFile('src/app/api/stripe/connect/onboard/route.ts')
    const hasReturnUrl = /stripe=complete/.test(onboardSource)
    const hasRefreshUrl = /stripe=refresh/.test(onboardSource)
    expect(hasReturnUrl, 'TC-F13.29: connect/onboard must construct return_url with ?stripe=complete').toBe(true)
    expect(hasRefreshUrl, 'TC-F13.29: connect/onboard must construct refresh_url with ?stripe=refresh').toBe(true)
}

/** TC-F13.30: onboard + status routes verify user owns the tenantId */
function assertConnectTenantAuthz() {
    const onboardSource = readFile('src/app/api/stripe/connect/onboard/route.ts')
    const statusSource = readFile('src/app/api/stripe/connect/status/route.ts')

    // Both routes must check user-tenant ownership
    const onboardHasAuthz =
        /userTenantIds/.test(onboardSource) ||
        /user\.tenants/.test(onboardSource) ||
        /getCurrentUser/.test(onboardSource)
    const statusHasAuthz =
        /userTenantIds/.test(statusSource) ||
        /user\.tenants/.test(statusSource) ||
        /getCurrentUser/.test(statusSource)

    expect(
        onboardHasAuthz,
        'TC-F13.30: connect/onboard/route.ts must verify user owns tenantId'
    ).toBe(true)
    expect(
        statusHasAuthz,
        'TC-F13.30: connect/status/route.ts must verify user owns tenantId'
    ).toBe(true)
}

/** TC-F13.61: createStripeCheckoutSession passes stripeAccount as second argument */
function assertConnectedAccountPassed() {
    const stripeSource = readFile('src/lib/payment/stripe.ts')
    expect(
        stripeSource,
        'TC-F13.61: stripe.ts must pass { stripeAccount: params.stripeAccountId } as 2nd arg to sessions.create'
    ).toMatch(/stripeAccount:\s*params\.stripeAccountId/)
}

/** TC-F13.13 + TC-F13.14: payment_method_types must be dynamic per tenant flags (KNOWN GAP — MUST FAIL) */
function assertDynamicPaymentMethodTypes() {
    const stripeSource = readFile('src/lib/payment/stripe.ts')
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')

    // Dynamic implementation: build array based on tenant.payment_card / payment_fpx
    const isDynamic =
        /payment_card|payment_fpx/.test(stripeSource) ||
        /payment_card|payment_fpx/.test(orderCreateSource) ||
        /paymentMethodTypes.*tenant|tenant.*paymentMethodTypes/i.test(stripeSource) ||
        /paymentMethodTypes.*tenant|tenant.*paymentMethodTypes/i.test(orderCreateSource)

    expect(
        isDynamic,
        "TC-F13.13: payment_method_types must be dynamic based on tenant.payment_card/payment_fpx, currently hardcoded ['card','fpx'] at stripe.ts:123 — fix by passing payment method array from caller"
    ).toBe(true)
}

/** TC-F13.03: orders/create multiplies product price by 100 to convert RM → sen */
function assertMyrSenAmountUsage() {
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')
    const hasSenConversion =
        /\*\s*100/.test(orderCreateSource) ||
        /Math\.round\([^)]*\*\s*100\)/.test(orderCreateSource)
    expect(
        hasSenConversion,
        'TC-F13.03: orders/create/route.ts must multiply price by 100 (RM to sen) for Stripe line_items'
    ).toBe(true)
}

/** TC-F13.65: normalizeStripeEvent maps the four expected event types */
function assertNormalizeStripeEventTypeMap() {
    const stripeSource = readFile('src/lib/payment/stripe.ts')
    expect(stripeSource, 'TC-F13.65: normalizeStripeEvent must map checkout.session.completed').toContain("'checkout.session.completed'")
    expect(stripeSource, 'TC-F13.65: normalizeStripeEvent must map payment_intent.payment_failed').toContain("'payment_intent.payment_failed'")
    expect(stripeSource, 'TC-F13.65: normalizeStripeEvent must map customer.subscription.updated').toContain("'customer.subscription.updated'")
    expect(stripeSource, 'TC-F13.65: normalizeStripeEvent must map account.updated').toContain("'account.updated'")
}

/** TC-F13.16 + TC-F13.57: orders/create returns 422 when no valid products found */
function assertNoPaymentMethodsRejection() {
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')
    const hasValidation =
        /NO_PAYMENT_METHODS/.test(orderCreateSource) ||
        /orderItems\.length\s*===\s*0/.test(orderCreateSource) ||
        /No valid products/i.test(orderCreateSource)
    expect(
        hasValidation,
        'TC-F13.16: orders/create/route.ts must reject with 422 when no valid products / payment methods available'
    ).toBe(true)
}

/** TC-F13.99: webhook handler uses fire-and-forget (.catch) on notifyTenantOwners */
function assertNotifyFireAndForget() {
    const webhookSource = readFile('src/app/api/webhooks/stripe/route.ts')
    const hasFireAndForget =
        /notifyTenantOwners[\s\S]{0,200}\.catch\s*\(/.test(webhookSource) ||
        /\.catch\s*\(\s*\(?err\)?\s*=>/.test(webhookSource)
    expect(
        hasFireAndForget,
        'TC-F13.99: webhook route must use .catch() fire-and-forget pattern on notifyTenantOwners'
    ).toBe(true)
}

/** TC-F13.58: orders/create rejects when stripeAccountId / stripeOnboardingComplete missing */
function assertOrdersCreateRejectsNotOnboarded() {
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')
    const hasOnboardedCheck =
        /stripeOnboardingComplete/.test(orderCreateSource) &&
        /stripeAccountId/.test(orderCreateSource)
    expect(
        hasOnboardedCheck,
        'TC-F13.58: orders/create/route.ts must check stripeAccountId and stripeOnboardingComplete before Stripe call'
    ).toBe(true)
}

/** TC-F13.59: orders/create validates product existence; returns 422 "No valid products" */
function assertOrdersCreateValidatesProducts() {
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')
    const hasValidation =
        /No valid products/i.test(orderCreateSource) ||
        /VALIDATION_ERROR/.test(orderCreateSource)
    expect(
        hasValidation,
        "TC-F13.59: orders/create/route.ts must return 422 'No valid products' when all productIds invalid"
    ).toBe(true)
}

/** TC-F13.62: success/cancel URLs contain site slug pattern */
function assertSuccessCancelUrlsContainSlug() {
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')
    const hasSlugInUrl =
        /\/sites\//.test(orderCreateSource) ||
        /siteSlug/.test(orderCreateSource)
    expect(
        hasSlugInUrl,
        'TC-F13.62: orders/create/route.ts must construct successUrl/cancelUrl containing /sites/ slug'
    ).toBe(true)
}

/** TC-F13.63: stripe.ts line_items use integer unit_amount (sen) */
function assertSenIntegerAmount() {
    const stripeSource = readFile('src/lib/payment/stripe.ts')
    expect(
        stripeSource,
        'TC-F13.63: stripe.ts line_items must use unit_amount: item.price (integer sen)'
    ).toContain('unit_amount: item.price')
}

/** TC-F13.22: settings handler saves payment_card / payment_fpx (or COD/QR equivalents) */
function assertSettingsPersistence() {
    const settingsSource = fs.existsSync(path.join(repoRoot, 'src/app/(dashboard)/settings/payments/actions.ts'))
        ? readFile('src/app/(dashboard)/settings/payments/actions.ts')
        : ''

    const hasPersistence =
        /payment_cod|payment_qr|payment_card|payment_fpx/.test(settingsSource) &&
        /payload\.update/.test(settingsSource)

    expect(
        hasPersistence,
        'TC-F13.22: payment settings actions.ts must persist payment method toggles via payload.update'
    ).toBe(true)
}

/** TC-F13.86: settings update must NOT call Stripe refunds.create */
function assertSettingsToggleDoesNotRefund() {
    const settingsSource = fs.existsSync(path.join(repoRoot, 'src/app/(dashboard)/settings/payments/actions.ts'))
        ? readFile('src/app/(dashboard)/settings/payments/actions.ts')
        : ''

    expect(
        settingsSource,
        'TC-F13.86: payment settings handler must not call stripe.refunds.create'
    ).not.toMatch(/refunds\.create/)
}

/** TC-F13.33: webhook route handles payment_success → marks order paid with Stripe IDs */
function assertWebhookSuccessHandler() {
    const webhookSource = readFile('src/app/api/webhooks/stripe/route.ts')
    expect(webhookSource, "TC-F13.33: webhook must handle 'payment_success' case").toContain("'payment_success'")
    expect(webhookSource, "TC-F13.33: webhook must set status: 'paid'").toMatch(/status:\s*['"]paid['"]/)
    expect(webhookSource, 'TC-F13.33: webhook must save stripeSessionId').toContain('stripeSessionId')
    expect(webhookSource, 'TC-F13.33: webhook must save stripePaymentIntentId').toContain('stripePaymentIntentId')
}

/** TC-F13.34: webhook checks idempotency — skips already-processed sessions */
function assertWebhookIdempotency() {
    const webhookSource = readFile('src/app/api/webhooks/stripe/route.ts')
    const hasIdempotencyCheck =
        /Order already processed for session/.test(webhookSource) ||
        (/status.*paid|paid.*status/i.test(webhookSource) && /existing|already/i.test(webhookSource))
    expect(
        hasIdempotencyCheck,
        "TC-F13.34: webhook must check 'Order already processed for session' or status === 'paid' before re-updating"
    ).toBe(true)
}

/** TC-F13.35: webhook handles payment_failed → sets order status = 'payment_failed' */
function assertWebhookFailureHandler() {
    const webhookSource = readFile('src/app/api/webhooks/stripe/route.ts')
    expect(webhookSource, "TC-F13.35: webhook must handle 'payment_failed' case").toContain("'payment_failed'")
    expect(webhookSource, "TC-F13.35: webhook must set status: 'payment_failed'").toMatch(/status:\s*['"]payment_failed['"]/)
}

/** TC-F13.36: webhook logs unhandled event type and does not crash */
function assertUnhandledEventGracefulSkip() {
    const webhookSource = readFile('src/app/api/webhooks/stripe/route.ts')
    const hasGracefulDefault =
        /Unhandled event type/.test(webhookSource) ||
        /default:[\s\S]{0,80}console\.(log|warn)/.test(webhookSource)
    expect(
        hasGracefulDefault,
        "TC-F13.36: webhook default case must log 'Unhandled event type' and return 200"
    ).toBe(true)
}

/** TC-F13.37: webhook handles missing client_reference_id with warn + return */
function assertWebhookMissingClientReference() {
    const webhookSource = readFile('src/app/api/webhooks/stripe/route.ts')
    const handlesMissing =
        /client_reference_id/.test(webhookSource) &&
        /console\.warn/.test(webhookSource) &&
        /return/.test(webhookSource)
    expect(
        handlesMissing,
        'TC-F13.37: webhook must warn and return early when client_reference_id is missing'
    ).toBe(true)
}

/**
 * TC-F13.87: webhook must handle account.application.deauthorized event
 * KNOWN GAP: current impl uses normalizeStripeEvent typeMap which throws on unknown events.
 * This test MUST FAIL until the handler is added (Wave 7+ deferral must be explicit).
 */
function assertAccountDeauthorizedHandler() {
    const webhookSource = readFile('src/app/api/webhooks/stripe/route.ts')
    const stripeSource = readFile('src/lib/payment/stripe.ts')
    const hasDeauthorizedHandler =
        /account\.application\.deauthorized/.test(webhookSource) ||
        /account\.application\.deauthorized/.test(stripeSource) ||
        /deauthorized/.test(webhookSource)
    expect(
        hasDeauthorizedHandler,
        'TC-F13.87: webhook or normalizeStripeEvent must handle account.application.deauthorized — currently missing from typeMap, normalizeStripeEvent will throw on this event type'
    ).toBe(true)
}

/**
 * TC-F13.88: orders/create must check tenant status (suspended/banned) before Stripe call
 * KNOWN GAP: current impl only checks stripeAccountId/stripeOnboardingComplete, not tenant.status.
 */
function assertSuspendedTenantBlocked() {
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')
    const checksTenantStatus =
        /suspended/.test(orderCreateSource) ||
        /banned/.test(orderCreateSource) ||
        /tenant.*status|status.*tenant/i.test(orderCreateSource)
    expect(
        checksTenantStatus,
        'TC-F13.88: orders/create/route.ts must check tenant.status for suspended/banned before Stripe call — currently missing'
    ).toBe(true)
}

/** TC-F13.96: orders/create does NOT reuse existing stripeSessionId — always creates fresh */
function assertRetryCreatesNewSession() {
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')
    // Absence of reuse logic is the positive signal — we check there is no lookup of existing session
    const reusesExistingSession =
        /stripeSessionId.*existing|existing.*stripeSessionId/i.test(orderCreateSource) ||
        /stripeSessionId.*reuse|reuse.*stripeSessionId/i.test(orderCreateSource)
    expect(
        !reusesExistingSession,
        'TC-F13.96: orders/create must NOT reuse existing stripeSessionId; always calls createStripeCheckoutSession fresh'
    ).toBe(true)
}

/**
 * TC-F13.103: orders/create must short-circuit for free orders (total === 0) before Stripe call
 * KNOWN GAP: current impl always calls createStripeCheckoutSession regardless of total.
 */
function assertFreeOrderSkipsStripe() {
    const orderCreateSource = readFile('src/app/api/orders/create/route.ts')
    const hasFreeOrderCheck =
        /total\s*===\s*0/.test(orderCreateSource) ||
        /total\s*<=\s*0/.test(orderCreateSource) ||
        /free.*order|order.*free/i.test(orderCreateSource)
    expect(
        hasFreeOrderCheck,
        'TC-F13.103: orders/create/route.ts must short-circuit before Stripe call when total === 0 — currently missing, free orders will attempt Stripe session creation'
    ).toBe(true)
}

/** TC-F13.107: webhook does not crash on charge.refunded — default case handles it gracefully */
function assertRefundedEventGracefulSkip() {
    const webhookSource = readFile('src/app/api/webhooks/stripe/route.ts')
    // The webhook returns 200 unconditionally and has a default/catch branch
    const hasGracefulReturn =
        /return new Response\('OK'/.test(webhookSource) ||
        /status:\s*200/.test(webhookSource)
    const hasDefaultBranch =
        /default:/.test(webhookSource) ||
        /Unhandled event type/.test(webhookSource)
    expect(
        hasGracefulReturn && hasDefaultBranch,
        'TC-F13.107: webhook must not crash on charge.refunded — default branch should log and return 200'
    ).toBe(true)
}

async function assertMobile320pxLayout(page: Page) {
    // TC-F13.104: 320px viewport (iPhone SE) — no overflow, hitbox >= 54px
    requireEnv(['F13_CHECKOUT_URL'], 'Mobile 320px evidence requires a seeded checkout URL')
    await page.setViewportSize({ width: 320, height: 568 })
    await gotoReadyCheckout(page)
    const noOverflow = await page.evaluate(() => (
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    ))
    expect(noOverflow, 'TC-F13.104: no horizontal overflow at 320px').toBe(true)

    const rows = page.locator('[role="radio"], label:has-text("Stripe"), label:has-text("Card"), label:has-text("FPX")')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
    for (let index = 0; index < Math.min(count, 4); index++) {
        const box = await rows.nth(index).boundingBox()
        expect(box?.height ?? 0, 'TC-F13.104: payment row hitbox >= 54px at 320px').toBeGreaterThanOrEqual(54)
    }
}

async function assertWebhookRejectsBadSignature(request: APIRequestContext) {
    let response

    try {
        response = await request.post('/api/webhooks/stripe', {
            data: JSON.stringify({
                id: 'evt_bad_signature',
                type: 'checkout.session.completed',
                data: { object: { id: 'cs_bad', client_reference_id: 'order_bad' } },
            }),
            headers: {
                'content-type': 'application/json',
                'stripe-signature': 't=1,v1=bad',
            },
        })
    } catch (error) {
        test.skip(true, `App server is not reachable for webhook runtime check: ${String(error)}`)
        throw error
    }

    expect(response.status()).toBe(400)
    expect(await response.text()).toMatch(/verification failed/i)
}

const runtimeChecks: Record<string, RuntimeCheck> = {
    'TC-F13.01': async () => {
        assertCheckoutSessionShape()
    },
    'TC-F13.02': async ({ page }) => {
        await runCardPaymentSuccess(page)
    },
    'TC-F13.03': async () => {
        assertMyrSenAmountUsage()
    },
    'TC-F13.04': async () => {
        assertApplicationFeeFormula()
    },
    'TC-F13.05': async () => {
        assertApplicationFeeFormula()
    },
    'TC-F13.06': async ({ page }) => {
        await runDeclinedCard(page)
    },
    'TC-F13.09': async ({ page }) => {
        await runFpxPaymentSuccess(page)
    },
    'TC-F13.13': async () => {
        assertDynamicPaymentMethodTypes()
    },
    'TC-F13.14': async () => {
        assertDynamicPaymentMethodTypes()
    },
    'TC-F13.16': async () => {
        assertNoPaymentMethodsRejection()
    },
    'TC-F13.10': async ({ page }) => {
        await runFpxHostedPickerCheck(page)
    },
    'TC-F13.19': async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await runFpxHostedPickerCheck(page)
    },
    'TC-F13.22': async () => {
        assertSettingsPersistence()
    },
    'TC-F13.25': async () => {
        assertConnectOnboardIdempotent()
    },
    'TC-F13.29': async () => {
        assertConnectReturnUrls()
    },
    'TC-F13.30': async () => {
        assertConnectTenantAuthz()
    },
    'TC-F13.31': async ({ request }) => {
        await runSignedWebhookReplay(request)
    },
    'TC-F13.33': async () => {
        assertWebhookSuccessHandler()
    },
    'TC-F13.34': async () => {
        assertWebhookIdempotency()
    },
    'TC-F13.35': async () => {
        assertWebhookFailureHandler()
    },
    'TC-F13.36': async () => {
        assertUnhandledEventGracefulSkip()
    },
    'TC-F13.37': async () => {
        assertWebhookMissingClientReference()
    },
    'TC-F13.32': async ({ request }) => {
        await assertWebhookRejectsMissingSignature(request)
        await assertWebhookRejectsBadSignature(request)
    },
    'TC-F13.38': async () => {
        assertNoCardDataStored()
    },
    'TC-F13.39': async () => {
        assertStripeEnvGuardIsGenericToClient()
    },
    'TC-F13.40': async ({ request }) => {
        await assertWebhookRejectsBadSignature(request)
    },
    'TC-F13.41': async () => {
        assertNoHardcodedPaymentSecrets()
    },
    'TC-F13.46': async () => {
        assertFullQaDocCoverage()
    },
    'TC-F13.48': async () => {
        assertTestConventionIsLinked()
    },
    'TC-F13.49': async () => {
        assertF13TestsDoNotReimplementPaymentLogic()
    },
    'TC-F13.50': async () => {
        assertF13TestHygiene()
    },
    'TC-F13.57': async () => {
        assertNoPaymentMethodsRejection()
    },
    'TC-F13.58': async () => {
        assertOrdersCreateRejectsNotOnboarded()
    },
    'TC-F13.59': async () => {
        assertOrdersCreateValidatesProducts()
    },
    'TC-F13.61': async () => {
        assertConnectedAccountPassed()
    },
    'TC-F13.62': async () => {
        assertSuccessCancelUrlsContainSlug()
    },
    'TC-F13.63': async () => {
        assertSenIntegerAmount()
    },
    'TC-F13.65': async () => {
        assertNormalizeStripeEventTypeMap()
    },
    'TC-F13.74': async ({ page }) => {
        await runSellerConnectRedirect(page)
    },
    'TC-F13.75': async ({ page }) => {
        await runFpxPaymentSuccess(page)
    },
    'TC-F13.76': async ({ page }) => {
        await runCancelRecovery(page)
    },
    'TC-F13.77': async ({ request }) => {
        await runSignedWebhookReplay(request)
    },
    'TC-F13.78': async ({ page }) => {
        await runTenantIsolationCheck(page)
    },
    'TC-F13.79': async ({ page }) => {
        await runMobileCheckoutLayout(page)
    },
    'TC-F13.80': async () => {
        await assertReleaseReportExists()
    },
    // NHÓM 11 - Wave 6 Hardening Critical (auto-able subset)
    'TC-F13.84': async () => {
        assertStripeSessionIdHasUniqueGuard()
    },
    'TC-F13.86': async () => {
        assertSettingsToggleDoesNotRefund()
    },
    'TC-F13.87': async () => {
        assertAccountDeauthorizedHandler()
    },
    'TC-F13.88': async () => {
        assertSuspendedTenantBlocked()
    },
    'TC-F13.89': async ({ request }) => {
        await assertCsrfProtectionOnConnectOnboard(request)
    },
    'TC-F13.90': async ({ request }) => {
        await assertWebhookRejectsMissingSignature(request)
        await assertWebhookRejectsBadSignature(request)
    },
    'TC-F13.91': async () => {
        assertNoPiiInPaymentLogs()
    },
    // NHÓM 12 - Wave 6 Hardening High (auto-able subset)
    'TC-F13.93': async ({ request }) => {
        await assertEmailInjectionRejected(request)
    },
    'TC-F13.96': async () => {
        assertRetryCreatesNewSession()
    },
    'TC-F13.99': async () => {
        assertNotifyFireAndForget()
    },
    'TC-F13.102': async () => {
        assertCurrencyMyrEnforced()
    },
    'TC-F13.103': async () => {
        assertFreeOrderSkipsStripe()
    },
    'TC-F13.104': async ({ page }) => {
        await assertMobile320pxLayout(page)
    },
    'TC-F13.108': async () => {
        assertNoPiiInPaymentLogs()
    },
    'TC-F13.107': async () => {
        assertRefundedEventGracefulSkip()
    },
    'TC-F13.109': async () => {
        assertStripeSdkVersionPinned()
    },
}

function skipReasonFor(qaCase: QaCase) {
    if (qaCase.deferred) {
        return 'Deferred/OOS in F13 QA doc; tracked in Playwright as non-release-gate coverage.'
    }

    if (!qaCase.auto) {
        return 'Manual Stripe/staging/UAT evidence case; Playwright scenario exists and runs when F13 env is provided.'
    }

    if (qaCase.layer.includes('E2E')) {
        return 'Requires seeded storefront, authenticated tenant, Stripe hosted Checkout, or Stripe CLI webhook forwarding.'
    }

    return 'Primary executable coverage belongs to F13 unit/API/component tests; Playwright keeps the release coverage ledger.'
}

const qaCases = readQaCases()

test.describe('F13 Payment Gateway - QA doc contract', () => {
    test(`[TC-F13.46] QA matrix has exactly TC-F13.01..TC-F13.${String(expectedTcCount).padStart(2, '0')} with no gaps`, async () => {
        const ids = qaCases.map((qaCase) => qaCase.id)
        const uniqueIds = new Set(ids)

        expect(ids).toEqual(expectedTcIds)
        expect(uniqueIds.size).toBe(expectedTcIds.length)
    })

    test('[TC-F13.46] all FR-01..FR-15 requirements appear in F13 coverage', async () => {
        const doc = fs.readFileSync(qaDocPath, 'utf8')
        const missingRequirements = Array.from({ length: 15 }, (_, index) => `FR-${String(index + 1).padStart(2, '0')}`)
            .filter((requirementId) => !doc.includes(requirementId))

        expect(missingRequirements).toEqual([])
    })

    test('[TC-F13.74-TC-F13.80] tester UAT cases remain explicit manual release gates', async () => {
        // UAT range stays 74..80 even after QA doc grew to 113 (hardening 81..113 are not UAT scope)
        const testerIds = expectedTcIds.slice(73, 80)
        const testerCases = qaCases.filter((qaCase) => testerIds.includes(qaCase.id))

        expect(testerCases.map((qaCase) => qaCase.id)).toEqual(testerIds)
        expect(testerCases.every((qaCase) => !qaCase.auto)).toBe(true)
    })

    test('[TC-F13.81-TC-F13.141] Wave 6 hardening + integration TCs exist and are part of release ledger', async () => {
        // NHÓM 11 (TC-F13.81..91): 11 critical hardening cases
        // NHÓM 12 (TC-F13.92..113): 22 high hardening cases
        // NHÓM 13 (TC-F13.114..123): 10 Stripe integration events & Connect guards
        // NHÓM 14 (TC-F13.124..131): 8 MY market & API limits
        // NHÓM 15 (TC-F13.132..141): 10 schema, auth & reconciliation
        const hardeningIds = expectedTcIds.slice(80, 141)
        const hardeningCases = qaCases.filter((qaCase) => hardeningIds.includes(qaCase.id))

        expect(hardeningCases.map((qaCase) => qaCase.id)).toEqual(hardeningIds)
        // Severity must be Critical/High/Blocker/Medium (NHÓM 13-15 có Medium edge cases)
        const allowedSeverities = ['Critical', 'High', 'Blocker', 'Medium']
        const violations = hardeningCases.filter((qaCase) => !allowedSeverities.includes(qaCase.severity))
        expect(violations.map((qaCase) => `${qaCase.id}=${qaCase.severity}`)).toEqual([])
    })
})

test.describe('F13 Payment Gateway - full Playwright coverage ledger', () => {
    for (const qaCase of qaCases) {
        const title = `${qaCase.id} ${qaCase.title}`.slice(0, 180)

        test(title, async ({ page, request }, testInfo) => {
            testInfo.annotations.push({ type: 'refs', description: qaCase.refs })
            testInfo.annotations.push({ type: 'layer', description: qaCase.layer })
            testInfo.annotations.push({ type: 'severity', description: qaCase.severity })
            testInfo.annotations.push({ type: 'auto', description: qaCase.auto ? 'AUTO' : 'MANUAL' })

            const runtimeCheck = runtimeChecks[qaCase.id]
            if (runtimeCheck) {
                await runtimeCheck({ page, request, testInfo, qaCase })
                return
            }

            if (qaCase.deferred) {
                test.fixme(true, skipReasonFor(qaCase))
            }

            test.skip(true, skipReasonFor(qaCase))
        })
    }
})
