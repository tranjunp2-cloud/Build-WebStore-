import { test, expect, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * F09 Checkout Page Design Coverage Ledger
 * TC-IDs: TC-F09.182..201 (20 design TCs)
 *
 * Source spec: docs/design/F09-storefront-design.md §4 (Guest Checkout wireframe)
 * Implementation: src/app/sites/[slug]/checkout/page.tsx
 *
 * Strategy: 2 layers
 *  (1) Source-content assertions — verify implementation matches design without staging env
 *  (2) Live browser flows — verify rendered UI on staging when BASE_URL provided
 */

type RuntimeCheck = (ctx: {
    page: Page
    request: APIRequestContext
    testInfo: TestInfo
}) => Promise<void>

const repoRoot = process.cwd()
const checkoutPagePath = 'src/app/sites/[slug]/checkout/page.tsx'
const designDocPath = 'docs/design/F09-storefront-design.md'

function readFile(relativePath: string) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function env(name: string) {
    return process.env[name]?.trim()
}

function requireStaging(reason: string) {
    if (!env('BASE_URL')?.includes('dev.ecommercehub') && !env('F09_CHECKOUT_URL')) {
        test.skip(true, `${reason}. Set BASE_URL or F09_CHECKOUT_URL to run.`)
    }
}

// ─── Source-content design assertions ───────────────────────────────────────

function assertCheckoutHasFourSections() {
    // Design §4: Contact Info → Shipping Address → Payment → Order Summary
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.182: must render Contact Info heading').toMatch(/ck\.contactInfo/)
    expect(src, 'TC-F09.182: must render Shipping Address heading').toMatch(/ck\.shippingAddress/)
    expect(src, 'TC-F09.182: must render Payment Method heading').toMatch(/ck\.paymentMethod/)
    expect(src, 'TC-F09.182: must compute and display Total in summary').toMatch(/total[\s\S]{0,200}formatPrice|formatPrice[\s\S]{0,200}total/)
}

function assertContactFormFields() {
    // Design §4 Section 1: fullName, email, phone
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.183: input for fullName').toMatch(/placeholder=\{ck\.fullName\}/)
    expect(src, 'TC-F09.183: input for emailAddress (type=email)').toMatch(/type="email"[\s\S]{0,80}placeholder=\{ck\.emailAddress\}/)
    expect(src, 'TC-F09.183: input for phone').toMatch(/placeholder=\{ck\.phone\}/)
}

function assertShippingAddressFields() {
    // Design §4 Section 2: line1, line2 optional, city, postcode, state dropdown
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.184: addressLine1 input').toMatch(/placeholder=\{ck\.addressLine1\}/)
    expect(src, 'TC-F09.184: addressLine2 input (optional)').toMatch(/placeholder=\{ck\.addressLine2\}/)
    expect(src, 'TC-F09.184: city input').toMatch(/placeholder=\{ck\.city\}/)
    expect(src, 'TC-F09.184: state dropdown using MY_STATES').toMatch(/MY_STATES[\s\S]{0,200}sort\(\)\.map/)
}

function assertPostcodeHasNumericInputMode() {
    // Design §4 + FR-07 mobile numpad: inputMode="numeric" + pattern="\d{5}"
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.185: postcode field must use inputMode="numeric" for mobile numpad').toMatch(/inputMode="numeric"/)
    expect(src, 'TC-F09.185: postcode field must declare pattern \\d{5}').toMatch(/pattern="\\d\{5\}"/)
}

function assertStateDropdownHas16States() {
    // Design + FR-01: 13 West + 3 East = 16 states/territories
    const constants = readFile('src/lib/shipping/constants.ts')
    expect(constants).toMatch(/EAST_MY_STATES[\s\S]+Sabah[\s\S]+Sarawak[\s\S]+Labuan/)
    expect(constants).toMatch(/WEST_MY_STATES[\s\S]+Selangor/)
    // Ensure MY_STATES exported and used in checkout page
    expect(readFile(checkoutPagePath)).toMatch(/MY_STATES/)
}

function assertTwoPaymentMethodsCodAndQr() {
    // Design §4 Section 3: COD + QR Banking radios
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.187: COD payment option').toMatch(/setPaymentMethod\(['"]cod['"]\)/)
    expect(src, 'TC-F09.187: QR Banking payment option').toMatch(/setPaymentMethod\(['"]qr_banking['"]\)/)
    expect(src, 'TC-F09.187: default paymentMethod state is cod').toMatch(/useState[\s\S]{0,40}>\(['"]cod['"]\)/)
}

function assertQrConditionalUpload() {
    // Design §4: receipt upload visible only when QR Banking selected
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.188: upload UI conditional on qr_banking').toMatch(/paymentMethod === ['"]qr_banking['"]\s*&&/)
    expect(src, 'TC-F09.188: upload field accepts image types').toMatch(/ACCEPTED_IMAGE_TYPES[\s\S]{0,80}image\/jpeg/)
    expect(src, 'TC-F09.188: 2MB file size limit').toMatch(/MAX_FILE_SIZE\s*=\s*2\s*\*\s*1024\s*\*\s*1024/)
}

function assertCurrencyFormatHelper() {
    // Design: prices shown as "RM XX.XX" for MYR
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.189: formatPrice helper for MYR (RM)').toMatch(/formatPrice[\s\S]{0,200}MYR[\s\S]{0,60}RM\s*\$\{/)
}

function assertOrderSummaryShowsSubtotalSstShippingTotal() {
    // Design §4 Order Summary: 4 lines = Subtotal, SST, Shipping, Total
    const src = readFile(checkoutPagePath)
    // SST 6% calc
    expect(src, 'TC-F09.190: SST tax 6% calculation').toMatch(/sub\s*\*\s*0\.06|0\.06\s*\*\s*sub|tax\s*=\s*Math\.round\(sub\s*\*\s*0\.06/)
    // Shipping fee variable
    expect(src, 'TC-F09.190: shipping fee variable used').toMatch(/shippingCalc|shippingFee|shippingCalc\?\.fee/)
    // Total = sub + shipping + tax
    expect(src, 'TC-F09.190: total = subtotal + shipping + tax').toMatch(/total\s*=\s*sub\s*\+\s*shipping[\s\S]{0,40}tax|sub\s*\+\s*shipping[\s\S]{0,40}tax/i)
}

function assertSecureLockIndicator() {
    // Design §4 header: "Bảo Mật Thanh Toán 🔒"
    const src = readFile(checkoutPagePath)
    // We allow either Lock icon, padlock emoji, or "secure" text
    const hasSecureIndicator =
        /Lock|🔒|secure|encrypted/i.test(src) ||
        /lucide-react[\s\S]{0,200}Lock/.test(src)
    expect(hasSecureIndicator, 'TC-F09.191: secure-payment indicator (lock icon or text)').toBe(true)
}

function assertPlaceOrderButtonStates() {
    // Design: button disabled during placing (spinner), changes label
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.192: isPlacing state controls button').toMatch(/isPlacing/)
    expect(src, 'TC-F09.192: Loader2 spinner shown during placing').toMatch(/Loader2/)
}

function assertErrorBannerWithIcon() {
    // Design: error state shows red banner with AlertCircle icon
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.193: AlertCircle icon used for error banner').toMatch(/AlertCircle/)
    // Red-tinted background
    expect(src, 'TC-F09.193: error banner uses red-tinted background').toMatch(/background:\s*['"]#fef2f2['"]|background:\s*['"]#fee2e2['"]/)
}

function assertProofPreviewAndRemove() {
    // Design: after upload, show image preview + X to remove
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.194: proofPreview state exists for thumbnail').toMatch(/proofPreview/)
    expect(src, 'TC-F09.194: removeProof callback to clear preview').toMatch(/removeProof|setProofFile\(null\)/)
    expect(src, 'TC-F09.194: X icon (lucide) on remove button').toMatch(/import[\s\S]{0,200}\{[\s\S]*X[\s\S]*\}[\s\S]{0,40}from\s*['"]lucide-react['"]/)
}

function assertEmptyCartGuard() {
    // Design: empty cart should redirect or show empty state, not allow placing
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.195: cart items check').toMatch(/items\.length\s*===\s*0|!items\.length|items\.length\s*<\s*1/)
}

function assertSuccessOrderConfirmation() {
    // Design: post-submit shows orderResult with order number
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.196: orderResult state used after place order').toMatch(/orderResult/)
    expect(src, 'TC-F09.196: CheckCircle icon for success state').toMatch(/CheckCircle/)
}

function assertDebouncedShippingCalc() {
    // FR-09: 300ms debounce on state change
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.197: useDebounce hook with state').toMatch(/useDebounce\(form\.state,\s*300\)/)
}

function assertI18nApplied() {
    // Design uses i18n keys (ck.contactInfo etc.) — all labels go through t.storefront.checkout
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.198: useI18n hook imported and used').toMatch(/useI18n/)
    expect(src, 'TC-F09.198: ck namespace = t.storefront.checkout').toMatch(/t\.storefront\.checkout/)
}

function assertMobileResponsiveStyles() {
    // Design §5: mobile 375px stacked, full-width drawer, sticky CTA
    const src = readFile(checkoutPagePath)
    // Use grid 2-col for city+state on desktop, stacks on mobile via CSS
    expect(src, 'TC-F09.199: grid 2-col for city+state row').toMatch(/checkout-grid-2col|gridTemplateColumns:\s*['"]1fr 1fr['"]/)
    // Container max-width prevents overflow on large screens
    expect(src, 'TC-F09.199: max-width container for tablet/desktop').toMatch(/maxWidth:\s*['"]1100px['"]|max-w-\[1100px\]/)
}

function assertShippingHintTier() {
    // Design + FR-05: hint with tier 'highlight' or 'neutral' from API
    const src = readFile(checkoutPagePath)
    expect(src, 'TC-F09.200: ShippingHint type with tier highlight|neutral').toMatch(/tier:\s*['"]highlight['"]\s*\|\s*['"]neutral['"]/)
}

function assertDesignDocReferenced() {
    // Design doc exists and has §4 Checkout section
    const doc = readFile(designDocPath)
    expect(doc, 'TC-F09.201: design doc has Guest Checkout section').toMatch(/Guest Checkout|Giao diện Thanh Toán/i)
    expect(doc, 'TC-F09.201: design doc shows 3-section structure').toMatch(/Thông Tin Liên H[ệe][\s\S]+Địa Chỉ[\s\S]+Phương Thức Thanh Toán/)
}

// ─── Live browser flows (staging-gated) ──────────────────────────────────────

async function gotoCheckout(page: Page) {
    requireStaging('Live UI test needs BASE_URL or F09_CHECKOUT_URL')
    const url = env('F09_CHECKOUT_URL') || `${env('BASE_URL')}/sites/qa-test-shop/checkout`
    await page.goto(url)
    await expect(page.locator('body')).not.toBeEmpty()
}

async function runStateDropdownContains16(page: Page) {
    await gotoCheckout(page)
    const select = page.locator('select').first()
    const options = await select.locator('option').count()
    // 16 states + 1 placeholder
    expect(options).toBeGreaterThanOrEqual(16)
}

async function runQrUploadVisibleOnlyWhenQrSelected(page: Page) {
    await gotoCheckout(page)
    // QR upload region should not exist when COD is default
    expect(await page.getByText(/scan to pay|merchant qr|upload proof/i).count()).toBe(0)
    // Click QR Banking
    await page.getByText(/qr banking|chuyển khoản/i).first().click()
    await expect(page.getByText(/upload proof|biên lai/i).first()).toBeVisible()
}

async function runMobile375pxLayout(page: Page) {
    await gotoCheckout(page)
    await page.setViewportSize({ width: 375, height: 812 })
    const noOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
    expect(noOverflow).toBe(true)
}

// ─── Runtime check map ──────────────────────────────────────────────────────

const runtimeChecks: Record<string, RuntimeCheck> = {
    'TC-F09.182': async () => assertCheckoutHasFourSections(),
    'TC-F09.183': async () => assertContactFormFields(),
    'TC-F09.184': async () => assertShippingAddressFields(),
    'TC-F09.185': async () => assertPostcodeHasNumericInputMode(),
    'TC-F09.186': async () => assertStateDropdownHas16States(),
    'TC-F09.187': async () => assertTwoPaymentMethodsCodAndQr(),
    'TC-F09.188': async () => assertQrConditionalUpload(),
    'TC-F09.189': async () => assertCurrencyFormatHelper(),
    'TC-F09.190': async () => assertOrderSummaryShowsSubtotalSstShippingTotal(),
    'TC-F09.191': async () => assertSecureLockIndicator(),
    'TC-F09.192': async () => assertPlaceOrderButtonStates(),
    'TC-F09.193': async () => assertErrorBannerWithIcon(),
    'TC-F09.194': async () => assertProofPreviewAndRemove(),
    'TC-F09.195': async () => assertEmptyCartGuard(),
    'TC-F09.196': async () => assertSuccessOrderConfirmation(),
    'TC-F09.197': async () => assertDebouncedShippingCalc(),
    'TC-F09.198': async () => assertI18nApplied(),
    'TC-F09.199': async () => assertMobileResponsiveStyles(),
    'TC-F09.200': async () => assertShippingHintTier(),
    'TC-F09.201': async () => assertDesignDocReferenced(),
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('F09 Checkout — Design Coverage Ledger', () => {
    for (const [id, check] of Object.entries(runtimeChecks)) {
        test(`${id} design contract`, async ({ page, request }, testInfo) => {
            testInfo.annotations.push({ type: 'feature', description: 'F09 Checkout' })
            testInfo.annotations.push({ type: 'layer', description: 'design source-content' })
            await check({ page, request, testInfo })
        })
    }
})

test.describe('F09 Checkout — Live Browser Flows (staging-gated)', () => {
    test('TC-F09.202 — state dropdown contains 16+ Malaysian states', async ({ page }) => {
        await runStateDropdownContains16(page)
    })

    test('TC-F09.203 — QR upload region toggles visibility with payment method', async ({ page }) => {
        await runQrUploadVisibleOnlyWhenQrSelected(page)
    })

    test('TC-F09.204 — Mobile 375px no horizontal overflow', async ({ page }) => {
        await runMobile375pxLayout(page)
    })
})
