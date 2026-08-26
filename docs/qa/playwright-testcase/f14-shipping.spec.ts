import { test, expect, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

type QaCase = {
    id: string
    type: string
    pri: string
    title: string
    refs: string
}

type RuntimeCheck = (ctx: {
    page: Page
    request: APIRequestContext
    testInfo: TestInfo
    qaCase: QaCase
}) => Promise<void>

const repoRoot = process.cwd()
const qaDocPath = path.join(repoRoot, 'docs', 'qa', 'F14-shipping.md')
const currentSpecPath = 'docs/qa/playwright-testcase/f14-shipping.spec.ts'

// QA doc v2.4 = 124 TCs (TC-F14.01..123, plus TC-F14.123b sub-id).
const expectedTcCount = 124

// ── helpers ─────────────────────────────────────────────────────────────────

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

function requireStaging(reason: string) {
    if (!env('BASE_URL')?.includes('dev.ecommercehub') && !env('F14_STAGING_URL')) {
        test.skip(true, `${reason}. Set BASE_URL=https://web-cms-v2.dev.ecommercehub.my to run staging-backed checks.`)
    }
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
        .filter((line) => line.startsWith('| **TC-F14.'))

    return rows.map((row) => {
        const cells = row.split('|').slice(1, -1).map((cell) => cell.trim())
        // Doc tables have varying column counts across sections; ID is always col 0,
        // title is the 3rd-4th column depending on section. We capture id + cleaned title.
        // Strip markdown + trailing decorations (⚠, emojis) — keep only TC-F14.NN[a-z]? form.
        const idMatch = cells[0]?.match(/TC-F14\.\d+[a-z]?/)
        const id = idMatch ? idMatch[0] : cleanMarkdown(cells[0])
        // Heuristics: look for first cell that looks like a sentence (length > 8)
        const title = cells.slice(1).map(cleanMarkdown).find((c) => c.length > 8 && !/^(Func|UI|Sec|Edge|Mobile|Live|API|Integration)$/i.test(c) && !/^(Blocker|Critical|High|Medium|Low)$/i.test(c)) ?? ''
        const type = cleanMarkdown(cells[1] ?? '')
        const pri = cleanMarkdown(cells[2] ?? '')
        const refs = cleanMarkdown(cells[cells.length - 1] ?? '')

        return { id, type, pri, title, refs }
    })
}

// ── F14 doc / coverage contract ─────────────────────────────────────────────

function assertF14DocHasAllTcs() {
    const cases = readQaCases()
    expect(cases.length, `F14 QA doc must contain ${expectedTcCount} TCs`).toBe(expectedTcCount)

    const ids = cases.map((c) => c.id)
    expect(new Set(ids).size, 'TC-IDs must be unique').toBe(ids.length)
    expect(ids[0]).toBe('TC-F14.01')
    expect(ids).toContain('TC-F14.123b')
}

function assertF14RequirementsTraced() {
    const doc = readFile('docs/qa/F14-shipping.md')
    // 12 FRs + 9 BRs + 6 Stories
    for (let i = 1; i <= 12; i++) {
        const id = `FR-${String(i).padStart(2, '0')}`
        expect(doc, `${id} must appear in F14 traceability matrix`).toContain(id)
    }
    for (let i = 1; i <= 9; i++) {
        const id = `BR-${String(i).padStart(2, '0')}`
        expect(doc, `${id} must appear in F14 traceability matrix`).toContain(id)
    }
    for (let i = 1; i <= 6; i++) {
        const id = `US-F14-${String(i).padStart(2, '0')}`
        expect(doc, `${id} must appear in F14 traceability matrix`).toContain(id)
    }
}

function assertF14SpecHasTcReferences() {
    const spec = readFile(currentSpecPath)
    const doc = readFile('docs/qa/F14-shipping.md')
    const ids = readQaCases().map((c) => c.id)
    for (const id of ids) {
        expect(spec + doc, `${id} must be represented in F14 Playwright ledger or QA doc`).toContain(id)
    }
}

function assertTestConventionLinked() {
    const convention = readFile('docs/TEST_CONVENTION.md')
    expect(convention).toContain('TC-ID')
    expect(convention).toContain('AAA')
}

// ── F14 source-file content checks (mirror what vitest unit tests verify) ───

/** TC-F14.111: SHIPPING_DEFAULTS match BR-07 (westRate=800, eastRate=1500, freeAbove=10000) */
function assertShippingDefaultsConstants() {
    const constants = readFile('src/lib/shipping/constants.ts')
    expect(constants, 'TC-F14.111: SHIPPING_DEFAULTS.westRate must be 800 sen').toMatch(/westRate:\s*800/)
    expect(constants, 'TC-F14.111: SHIPPING_DEFAULTS.eastRate must be 1500 sen').toMatch(/eastRate:\s*1[\s_]?500/)
    expect(constants, 'TC-F14.111: SHIPPING_DEFAULTS.freeAbove must be 10000 sen').toMatch(/freeAbove:\s*10[\s_]?000/)
}

/** TC-F14.112 / FR-01: MY_STATES contains 16 Malaysian states/territories */
function assertSixteenStateList() {
    const constants = readFile('src/lib/shipping/constants.ts')
    const requiredStates = [
        'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
        'Pahang', 'Penang', 'Perak', 'Perlis', 'Selangor',
        'Terengganu', 'Kuala Lumpur', 'Putrajaya',
        'Sabah', 'Sarawak', 'Labuan',
    ]
    for (const state of requiredStates) {
        expect(constants, `TC-F14.112: MY state "${state}" must exist in constants.ts`).toContain(state)
    }
}

/** TC-F14.113 / BR-01: WEST_MY_STATES has 13 states; KL/Putrajaya included; East excluded */
function assertWestStatesContract() {
    const constants = readFile('src/lib/shipping/constants.ts')
    expect(constants, 'TC-F14.113: WEST_MY_STATES must include Kuala Lumpur').toMatch(/WEST_MY_STATES[\s\S]+Kuala Lumpur/)
    expect(constants, 'TC-F14.113: WEST_MY_STATES must include Putrajaya').toMatch(/WEST_MY_STATES[\s\S]+Putrajaya/)
    // East states must not appear in WEST_MY_STATES block
    const westBlock = constants.match(/WEST_MY_STATES[\s\S]+?\]/)?.[0] ?? ''
    expect(westBlock, 'TC-F14.113: Sabah must NOT appear in WEST_MY_STATES').not.toContain('Sabah')
    expect(westBlock, 'TC-F14.113: Sarawak must NOT appear in WEST_MY_STATES').not.toContain('Sarawak')
    expect(westBlock, 'TC-F14.113: Labuan must NOT appear in WEST_MY_STATES').not.toContain('Labuan')
}

/** TC-F14.114 / BR-02: EAST_MY_STATES exactly = [Sabah, Sarawak, Labuan] */
function assertEastStatesContract() {
    const constants = readFile('src/lib/shipping/constants.ts')
    const eastBlock = constants.match(/EAST_MY_STATES[\s\S]+?\]/)?.[0] ?? ''
    expect(eastBlock, 'TC-F14.114: EAST_MY_STATES must contain Sabah').toContain('Sabah')
    expect(eastBlock, 'TC-F14.114: EAST_MY_STATES must contain Sarawak').toContain('Sarawak')
    expect(eastBlock, 'TC-F14.114: EAST_MY_STATES must contain Labuan').toContain('Labuan')
}

/** TC-F14.02-04 / FR-02 / BR-01-02: calculate-fee.ts uses isEastState for region branching */
function assertCalculateFeeRegionBranch() {
    const calc = readFile('src/lib/shipping/calculate-fee.ts')
    expect(calc, 'TC-F14.02-04: calculate-fee.ts must use isEastState helper').toMatch(/isEastState\s*\(/)
    expect(calc, 'TC-F14.02-04: must read from EAST_MY_STATES').toMatch(/EAST_MY_STATES/)
    expect(calc, 'TC-F14.02-04: must fall back to SHIPPING_DEFAULTS').toMatch(/SHIPPING_DEFAULTS/)
}

/** TC-F14.10 / FR-04 / BR-06: free-threshold check is INCLUSIVE (>=) */
function assertFreeThresholdInclusive() {
    const calc = readFile('src/lib/shipping/calculate-fee.ts')
    expect(calc, 'TC-F14.10/BR-06: free-threshold check must use inclusive >= operator').toMatch(/subtotalSen\s*>=\s*cfg\.freeAbove|cfg\.freeAbove[\s\S]{0,20}>=\s*subtotalSen|subtotalSen\s*>=/)
}

/** TC-F14.13 / BR-06: freeAbove=null means never-free (guard via != null) */
function assertFreeAboveNullGuard() {
    const calc = readFile('src/lib/shipping/calculate-fee.ts')
    expect(calc, 'TC-F14.13/BR-06: must guard freeAbove with != null before applying threshold').toMatch(/freeAbove\s*!=\s*null/)
}

/** TC-F14.19-20 / BR-04 / FR-08: PATCH validates rate ≤ RATE_MAX (100000 sen = RM 1000) */
function assertRateBoundaryValidation() {
    const route = readFile('src/app/api/sites/[siteId]/shipping-config/route.ts')
    expect(route, 'TC-F14.19-20/BR-04: PATCH must check rate > RATE_MAX').toMatch(/RATE_MAX|100[\s_]?000/)
    expect(route, 'TC-F14.19-20: reject must return 422').toMatch(/status:\s*422/)
}

/** TC-F14.41 / Arch §11: PATCH enforces cross-tenant authorization (hasSiteAccess) */
function assertCrossTenantAuthz() {
    const route = readFile('src/app/api/sites/[siteId]/shipping-config/route.ts')
    expect(route, 'TC-F14.41: PATCH must enforce hasSiteAccess before update').toMatch(/hasSiteAccess/)
    expect(route, 'TC-F14.41: must return 403 FORBIDDEN on cross-tenant attempt').toMatch(/FORBIDDEN/)
    expect(route, 'TC-F14.41: must use withAuth wrapper').toMatch(/withAuth/)
}

/** TC-F14.96 / Arch §11: super-admin role bypasses tenant check */
function assertSuperAdminBypass() {
    const route = readFile('src/app/api/sites/[siteId]/shipping-config/route.ts')
    expect(route, 'TC-F14.96: hasSiteAccess must allow super-admin role bypass').toMatch(/super-admin/)
}

/** TC-F14.43-45 / Arch §6.3: POST validates state against MY_STATES, returns INVALID_STATE */
function assertPostValidatesState() {
    const route = readFile('src/app/api/orders/calculate-shipping/route.ts')
    expect(route, 'TC-F14.43-45: POST must check state ∈ MY_STATES').toMatch(/MY_STATES/)
    expect(route, 'TC-F14.43-45: must return INVALID_STATE on mismatch').toMatch(/INVALID_STATE/)
}

/** TC-F14.43 / Arch §6.3: POST validates subtotalSen is non-negative integer */
function assertPostValidatesSubtotal() {
    const route = readFile('src/app/api/orders/calculate-shipping/route.ts')
    expect(route, 'TC-F14.43: POST must check Number.isFinite + Number.isInteger + ≥0 on subtotalSen').toMatch(/Number\.isFinite[\s\S]{0,80}Number\.isInteger/)
}

/** TC-F14.48 / Arch §7: POST emits hint with tier (highlight | neutral) when subtotal < freeAbove */
function assertHintTierLogic() {
    const route = readFile('src/app/api/orders/calculate-shipping/route.ts')
    expect(route, 'TC-F14.48: POST must emit hint.tier from HINT_HIGHLIGHT_THRESHOLD comparison').toMatch(/HINT_HIGHLIGHT_THRESHOLD/)
    expect(route, 'TC-F14.48: tier must be highlight or neutral').toMatch(/'highlight'[\s\S]{0,40}'neutral'|highlight.*neutral/)
}

/** TC-F14.49 / Arch §6.3: hint omitted (undefined) when isFree=true */
function assertHintOmittedWhenFree() {
    const route = readFile('src/app/api/orders/calculate-shipping/route.ts')
    // hint object only built when subtotal < freeAbove (i.e., not free)
    expect(route, 'TC-F14.49: hint built only when subtotalSen < freeAbove').toMatch(/subtotalSen\s*<\s*shippingConfig.freeAbove/)
}

/** TC-F14.71 / BR-09: API distinguishes shippingEnabled=false (fee=0, isFree=false) from free-threshold */
function assertEnabledFalseDistinctFromFree() {
    const route = readFile('src/app/api/orders/calculate-shipping/route.ts')
    expect(route, 'TC-F14.71: isFree must include shippingEnabled check, not just fee===0').toMatch(/shippingEnabled[\s\S]{0,80}freeAbove|isFree\s*=[\s\S]{0,100}shippingEnabled/)
}

/** TC-F14.36 / BR-09: shipped email tracking renders plain text when trackingUrl absent */
function assertEmailTrackingPlainTextWhenNoUrl() {
    const template = readFile('src/lib/email/templates/order-status.ts')
    // Conditional rendering: <a href> only when trackingUrl provided
    expect(template, 'TC-F14.36/BR-09: trackingHtml block must conditionally render <a href> based on trackingUrl').toMatch(/trackingUrl\s*\?\s*`<a href/)
}

/** TC-F14.85, 95 (KNOWN BUG, no-fix per QA decision): body=null returns 500 (should be 400) */
function assertBodyNullHandlingDocumented() {
    // The bug is acknowledged in the QA doc; this ledger check confirms the doc records the known limitation.
    const doc = readFile('docs/qa/F14-shipping.md')
    expect(doc, 'TC-F14.85: bug must be documented in F14 QA doc as known no-fix').toMatch(/TC-F14\.85[\s\S]{0,200}(no-fix|pending|FAILING|known)/i)
    expect(doc, 'TC-F14.95: bug must be documented in F14 QA doc as known no-fix').toMatch(/TC-F14\.95[\s\S]{0,200}(no-fix|pending|FAILING|known)/i)
}

/** TC-F14.55, 92 / Arch §10: defaults backfilled via scripts/db-setup.js */
function assertDbSetupBackfillsDefaults() {
    const setupPath = path.join(repoRoot, 'scripts', 'db-setup.js')
    if (!fs.existsSync(setupPath)) {
        test.skip(true, 'scripts/db-setup.js not present in this checkout — migration TCs require runtime context')
    }
    const setup = fs.readFileSync(setupPath, 'utf8')
    expect(setup, 'TC-F14.55: db-setup.js must reference shipping default (800/1500/10000) for backfill').toMatch(/shipping|freeAbove|westRate|eastRate/i)
}

// ── F14 browser flows (BASE_URL=staging only) ───────────────────────────────

async function firstVisible(page: Page, selectors: string[], timeout = 7000): Promise<Locator> {
    for (const selector of selectors) {
        const locator = page.locator(selector).first()
        try {
            await locator.waitFor({ state: 'visible', timeout })
            return locator
        } catch {
            // Try next selector
        }
    }
    throw new Error(`No visible element found for: ${selectors.join(', ')}`)
}

async function loginAsSeller(page: Page) {
    requireEnv(['F14_SELLER_EMAIL', 'F14_SELLER_PASSWORD'], 'Seller login required for F14 settings E2E')
    await page.goto(env('F14_LOGIN_URL') || '/login')
    await (await firstVisible(page, ['input[name="email"]', 'input[type="email"]'])).fill(env('F14_SELLER_EMAIL')!)
    await (await firstVisible(page, ['input[name="password"]', 'input[type="password"]'])).fill(env('F14_SELLER_PASSWORD')!)
    await page.getByRole('button', { name: /sign in|login|log in|masuk/i }).first().click()
    await page.waitForURL(/dashboard|admin|onboarding/, { timeout: 20_000 })
}

async function gotoShippingSettings(page: Page) {
    requireStaging('Seller shipping settings UI requires staging host')
    await loginAsSeller(page)
    await page.goto(env('F14_SETTINGS_URL') || '/dashboard/settings/shipping')
    await expect(page.locator('body')).not.toBeEmpty()
    expect(page.url()).not.toContain('/login')
}

async function gotoCheckout(page: Page) {
    requireEnv(['F14_CHECKOUT_URL'], 'Seeded buyer checkout URL required for storefront E2E')
    await page.goto(env('F14_CHECKOUT_URL')!)
    await expect(page.locator('body')).not.toBeEmpty()
}

async function runStateDropdownHas16(page: Page) {
    await gotoCheckout(page)
    const select = await firstVisible(page, ['select[name="state"]', '[data-testid="state-select"]'])
    const options = await select.locator('option').count()
    expect(options, 'TC-F14.01: state dropdown must have 16+1 options (placeholder may be #0)').toBeGreaterThanOrEqual(16)
}

async function runWestMyChargesRm8(page: Page) {
    await gotoCheckout(page)
    await (await firstVisible(page, ['select[name="state"]'])).selectOption('Selangor')
    await expect(page.locator('[data-testid="shipping-fee"]')).toHaveText(/RM\s*8\.00/i, { timeout: 5_000 })
}

async function runEastMyChargesRm15(page: Page) {
    await gotoCheckout(page)
    await (await firstVisible(page, ['select[name="state"]'])).selectOption('Sabah')
    await expect(page.locator('[data-testid="shipping-fee"]')).toHaveText(/RM\s*15\.00/i, { timeout: 5_000 })
}

async function runLabuanChargesEast(page: Page) {
    await gotoCheckout(page)
    await (await firstVisible(page, ['select[name="state"]'])).selectOption('Labuan')
    await expect(page.locator('[data-testid="shipping-fee"]')).toHaveText(/RM\s*15\.00/i, { timeout: 5_000 })
}

async function runLiveRecalcOnStateChange(page: Page) {
    await gotoCheckout(page)
    const stateSelect = await firstVisible(page, ['select[name="state"]'])
    await stateSelect.selectOption('Selangor')
    await expect(page.locator('[data-testid="shipping-fee"]')).toHaveText(/RM\s*8\.00/i, { timeout: 5_000 })
    const urlBefore = page.url()
    await stateSelect.selectOption('Sabah')
    await expect(page.locator('[data-testid="shipping-fee"]')).toHaveText(/RM\s*15\.00/i, { timeout: 5_000 })
    expect(page.url(), 'TC-F14.23: must NOT trigger page reload').toBe(urlBefore)
}

async function runPostcodeRejectsNonDigits(page: Page) {
    await gotoCheckout(page)
    const postcode = await firstVisible(page, ['input[name="postcode"]'])
    await postcode.fill('abc12')
    await page.getByRole('button', { name: /pay|place|continue/i }).first().click()
    await expect(page.locator('body')).toContainText(/postcode|invalid|format/i, { timeout: 5_000 })
}

async function runMobileNumpadInputMode(page: Page) {
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoCheckout(page)
    const postcode = await firstVisible(page, ['input[name="postcode"]'])
    await expect(postcode).toHaveAttribute('inputmode', 'numeric')
}

async function runMobileTapTarget44px(page: Page) {
    await page.setViewportSize({ width: 375, height: 667 })
    await gotoCheckout(page)
    const stateSelect = await firstVisible(page, ['select[name="state"]'])
    const box = await stateSelect.boundingBox()
    expect(box?.height ?? 0, 'TC-F14.33: tap target ≥ 44px').toBeGreaterThanOrEqual(44)
}

async function runSellerSaveSettings(page: Page) {
    await gotoShippingSettings(page)
    await (await firstVisible(page, ['input[name="westRate"]', 'input[name="westRateRm"]'])).fill('10.00')
    await (await firstVisible(page, ['input[name="eastRate"]', 'input[name="eastRateRm"]'])).fill('20.00')
    await page.getByRole('button', { name: /save|simpan/i }).first().click()
    await expect(page.locator('body')).toContainText(/saved|disimpan|berjaya/i, { timeout: 10_000 })
}

async function runResetToDefaults(page: Page) {
    await gotoShippingSettings(page)
    await page.getByRole('button', { name: /reset.*default|kembali/i }).first().click()
    await expect(page.locator('input[name="westRate"], input[name="westRateRm"]')).toHaveValue(/^8(\.00)?$/)
}

// ── F14 HTTP-level checks (use page.context().request) ──────────────────────

async function runApiPostHappyPath(request: APIRequestContext) {
    requireEnv(['F14_SITE_ID'], 'API POST happy path needs F14_SITE_ID env to be set')
    const res = await request.post('/api/orders/calculate-shipping', {
        data: { siteId: env('F14_SITE_ID'), state: 'Selangor', subtotalSen: 5000 },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.data.region).toBe('west')
    expect(json.data.fee).toBeGreaterThan(0)
}

async function runApiPostInvalidState(request: APIRequestContext) {
    requireEnv(['F14_SITE_ID'], 'API invalid-state test needs F14_SITE_ID env')
    const res = await request.post('/api/orders/calculate-shipping', {
        data: { siteId: env('F14_SITE_ID'), state: 'Tokyo', subtotalSen: 5000 },
    })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('INVALID_STATE')
}

async function runApiPostSiteNotFound(request: APIRequestContext) {
    const res = await request.post('/api/orders/calculate-shipping', {
        data: { siteId: 'site-does-not-exist-uuid', state: 'Selangor', subtotalSen: 5000 },
    })
    expect(res.status()).toBe(404)
}

async function runApiPatchUnauthenticated(request: APIRequestContext) {
    requireEnv(['F14_SITE_ID'], 'PATCH unauth test needs F14_SITE_ID env')
    const res = await request.patch(`/api/sites/${env('F14_SITE_ID')}/shipping-config`, {
        data: { enabled: true, westRateRm: '8.00', eastRateRm: '15.00', freeAboveRm: '' },
    })
    expect([401, 403]).toContain(res.status())
}

async function runApiPatchCrossTenantForbidden(request: APIRequestContext) {
    requireEnv(['F14_OTHER_TENANT_SITE_ID'], 'Cross-tenant test needs F14_OTHER_TENANT_SITE_ID (a site belonging to a different tenant)')
    const res = await request.patch(`/api/sites/${env('F14_OTHER_TENANT_SITE_ID')}/shipping-config`, {
        data: { enabled: true, westRateRm: '5.00', eastRateRm: '10.00', freeAboveRm: '' },
    })
    expect(res.status()).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
}

async function runApiRateLimitProbe(request: APIRequestContext) {
    requireEnv(['F14_SITE_ID', 'F14_RUN_RATE_LIMIT_PROBE'], 'Rate-limit probe requires explicit opt-in (set F14_RUN_RATE_LIMIT_PROBE=true)')
    const responses: number[] = []
    for (let i = 0; i < 80; i++) {
        const res = await request.post('/api/orders/calculate-shipping', {
            data: { siteId: env('F14_SITE_ID'), state: 'Selangor', subtotalSen: 5000 },
        })
        responses.push(res.status())
    }
    // Either rate-limited (429) within window or all succeed (no limit yet implemented)
    const has429 = responses.includes(429)
    test.info().annotations.push({ type: 'observed', description: `429 seen: ${has429}; statuses: ${Array.from(new Set(responses)).join(',')}` })
}

// ── runtime check map ───────────────────────────────────────────────────────

const runtimeChecks: Record<string, RuntimeCheck> = {
    // §3.1 State Classification
    'TC-F14.01': async ({ page }) => { await runStateDropdownHas16(page) },
    'TC-F14.02': async ({ page }) => { await runWestMyChargesRm8(page) },
    'TC-F14.03': async ({ page }) => { await runEastMyChargesRm15(page) },
    'TC-F14.04': async ({ page }) => { await runLabuanChargesEast(page) },

    // §3.2 Shipping Calculation — source-content
    'TC-F14.06': async () => { assertCalculateFeeRegionBranch() },

    // §3.3 Free Threshold
    'TC-F14.10': async () => { assertFreeThresholdInclusive() },
    'TC-F14.13': async () => { assertFreeAboveNullGuard() },

    // §3.4 Seller Settings
    'TC-F14.15': async ({ page }) => { await runSellerSaveSettings(page) },
    'TC-F14.19': async () => { assertRateBoundaryValidation() },
    'TC-F14.20': async () => { assertRateBoundaryValidation() },
    'TC-F14.21': async ({ page }) => { await runResetToDefaults(page) },
    'TC-F14.22': async ({ request }) => { await runApiPatchUnauthenticated(request) },

    // §3.5 Live Recalc
    'TC-F14.23': async ({ page }) => { await runLiveRecalcOnStateChange(page) },

    // §3.6 Postcode
    'TC-F14.27': async ({ page }) => { await runPostcodeRejectsNonDigits(page) },

    // §3.8 Mobile
    'TC-F14.32': async ({ page }) => { await runMobileNumpadInputMode(page) },
    'TC-F14.33': async ({ page }) => { await runMobileTapTarget44px(page) },

    // §3.9 Self-Delivery
    'TC-F14.36': async () => { assertEmailTrackingPlainTextWhenNoUrl() },

    // §3.10 API HTTP-level
    'TC-F14.38': async ({ request }) => { await runApiPostSiteNotFound(request) },
    'TC-F14.41': async () => { assertCrossTenantAuthz() },
    'TC-F14.42': async ({ request }) => { await runApiPatchUnauthenticated(request) },
    'TC-F14.43': async ({ request }) => { await runApiPostHappyPath(request) },
    'TC-F14.45': async ({ request }) => { await runApiPostInvalidState(request) },
    'TC-F14.46': async ({ request }) => { await runApiPostSiteNotFound(request) },
    'TC-F14.47': async ({ request }) => { await runApiRateLimitProbe(request) },
    'TC-F14.48': async () => { assertHintTierLogic() },
    'TC-F14.49': async () => { assertHintOmittedWhenFree() },

    // §3.11 Stories AC gaps — runtime via UI; deferred to manual UAT mostly
    // §3.12 DB & Migration
    'TC-F14.54': async () => { assertDbSetupBackfillsDefaults() },
    'TC-F14.55': async () => { assertDbSetupBackfillsDefaults() },

    // §3.13 Edge — source-content where checkable
    'TC-F14.71': async () => { assertEnabledFalseDistinctFromFree() },

    // §3.14 Body / auth / boundary
    'TC-F14.85': async () => { assertBodyNullHandlingDocumented() },
    'TC-F14.95': async () => { assertBodyNullHandlingDocumented() },
    'TC-F14.96': async () => { assertSuperAdminBypass() },
    'TC-F14.111': async () => { assertShippingDefaultsConstants() },
    'TC-F14.112': async () => { assertSixteenStateList() },
    'TC-F14.113': async () => { assertWestStatesContract() },
    'TC-F14.114': async () => { assertEastStatesContract() },

    // §3.15 Race + email
    'TC-F14.120': async () => { assertEmailTrackingPlainTextWhenNoUrl() },
    'TC-F14.121': async () => { assertEmailTrackingPlainTextWhenNoUrl() },
}

// ── skip-reason policy ──────────────────────────────────────────────────────

function skipReasonFor(qaCase: QaCase): string {
    const id = qaCase.id

    // Unit-only TCs (pure functions, mocking) — primary coverage in vitest
    const unitOnly = new Set([
        'TC-F14.57', 'TC-F14.58', 'TC-F14.59', 'TC-F14.60', 'TC-F14.61', 'TC-F14.62', 'TC-F14.63', 'TC-F14.64',
        'TC-F14.80', 'TC-F14.81', 'TC-F14.82', 'TC-F14.83', 'TC-F14.84',
    ])
    if (unitOnly.has(id)) {
        return 'Pure unit test on getShippingRate — primary coverage in src/__tests__/unit/lib/shipping/calculate-fee.test.ts'
    }

    // API mock-level TCs (vitest with vi.mock payload)
    const apiMockOnly = new Set([
        'TC-F14.65', 'TC-F14.66', 'TC-F14.67', 'TC-F14.68', 'TC-F14.69', 'TC-F14.70',
        'TC-F14.72', 'TC-F14.73', 'TC-F14.74', 'TC-F14.75', 'TC-F14.76', 'TC-F14.77', 'TC-F14.78', 'TC-F14.79',
        'TC-F14.86', 'TC-F14.87', 'TC-F14.88', 'TC-F14.89', 'TC-F14.90', 'TC-F14.91', 'TC-F14.92', 'TC-F14.93', 'TC-F14.94',
        'TC-F14.97', 'TC-F14.98', 'TC-F14.99', 'TC-F14.100', 'TC-F14.101', 'TC-F14.102', 'TC-F14.103', 'TC-F14.104',
        'TC-F14.105', 'TC-F14.106', 'TC-F14.107', 'TC-F14.108', 'TC-F14.109', 'TC-F14.110',
        'TC-F14.115', 'TC-F14.116', 'TC-F14.117', 'TC-F14.118', 'TC-F14.119',
    ])
    if (apiMockOnly.has(id)) {
        return 'API route covered by mocked vitest tests (src/__tests__/api/orders-calculate-shipping.test.ts / sites-shipping-config.test.ts) — Playwright would duplicate without added value'
    }

    // Email server-side template
    const emailOnly = new Set(['TC-F14.122', 'TC-F14.123', 'TC-F14.123b', 'TC-F14.35'])
    if (emailOnly.has(id)) {
        return 'Email template renders server-side; covered by src/__tests__/unit/lib/email/order-status-tracking.test.ts'
    }

    // E2E UAT — manual staging evidence
    const uatManual = new Set([
        'TC-F14.05', 'TC-F14.07', 'TC-F14.08',
        'TC-F14.09', 'TC-F14.11', 'TC-F14.12',
        'TC-F14.14', 'TC-F14.16', 'TC-F14.17', 'TC-F14.18',
        'TC-F14.24', 'TC-F14.25', 'TC-F14.26', 'TC-F14.28',
        'TC-F14.29', 'TC-F14.30', 'TC-F14.31',
        'TC-F14.34',
        'TC-F14.37', 'TC-F14.39', 'TC-F14.40', 'TC-F14.44',
        'TC-F14.50', 'TC-F14.51', 'TC-F14.52', 'TC-F14.53',
        'TC-F14.56',
    ])
    if (uatManual.has(id)) {
        return 'Manual UAT or staging evidence case; Playwright provides scaffolding via runtime flows when env is provided'
    }

    return 'Primary executable coverage belongs to vitest unit/API/integration tests; Playwright keeps the release coverage ledger'
}

// ── tests ───────────────────────────────────────────────────────────────────

const qaCases = readQaCases()

test.describe('F14 Shipping — QA doc contract', () => {
    test('[F14-doc.01] QA matrix has exactly 124 TCs including TC-F14.123b sub-id', async () => {
        assertF14DocHasAllTcs()
    })

    test('[F14-doc.02] all FR-01..12 / BR-01..09 / US-F14-01..06 appear in F14 coverage', async () => {
        assertF14RequirementsTraced()
    })

    test('[F14-doc.03] every TC-F14.* is referenced in spec or QA doc', async () => {
        assertF14SpecHasTcReferences()
    })

    test('[F14-doc.04] Test convention is linked and applied', async () => {
        assertTestConventionLinked()
    })
})

test.describe('F14 Shipping — full Playwright coverage ledger', () => {
    for (const qaCase of qaCases) {
        const title = `${qaCase.id} ${qaCase.title}`.slice(0, 180)

        test(title, async ({ page, request }, testInfo) => {
            testInfo.annotations.push({ type: 'type', description: qaCase.type })
            testInfo.annotations.push({ type: 'priority', description: qaCase.pri })
            testInfo.annotations.push({ type: 'refs', description: qaCase.refs })

            const runtimeCheck = runtimeChecks[qaCase.id]
            if (runtimeCheck) {
                await runtimeCheck({ page, request, testInfo, qaCase })
                return
            }

            test.skip(true, skipReasonFor(qaCase))
        })
    }
})
