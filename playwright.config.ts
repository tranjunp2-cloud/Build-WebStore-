import { defineConfig, devices } from '@playwright/test'

const isStaging = process.env.BASE_URL?.includes('dev.ecommercehub')
const hasE2EAccount = Boolean(
    process.env.TEST_EMAIL
    && process.env.TEST_PASSWORD
    && process.env.E2E_TEST_OTP_CODE,
)
export const F37_CUSTOM_DOMAIN_TEST = /\[TC-F37-03-52\]/

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false, // Run sequentially — tests share auth state
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
    timeout: isStaging ? 90_000 : 60_000, // Staging needs more time (network latency)
    expect: {
        timeout: isStaging ? 15_000 : 10_000,
    },
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
        actionTimeout: isStaging ? 20_000 : 15_000,
    },
    projects: [
        // Smoke tests — no auth needed, run independently
        {
            name: 'smoke',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /smoke\.spec\.ts/,
        },
        // Auth setup — runs first, saves auth state
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
        },
        // Authenticated tests — reuse auth state from setup
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
            testIgnore: [/.*\.setup\.ts/, /smoke\.spec\.ts/],
        },
        // Public storefront regressions required by repo review rules live in
        // tests/*.spec.ts and render without authenticated browser state.
        {
            name: 'storefront-regression',
            testDir: './tests',
            testMatch: /(cart-drawer|product-grid-qa-rework)\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: undefined,
            },
            // Keep F37 reachable from the shared CI project's existing selection.
            dependencies: ['f37-regression'],
        },
        // F37 uses setup's saved auth only in a separate API context to discover
        // account-owned fixtures; storefront page assertions remain public.
        {
            name: 'f37-regression',
            testDir: './tests',
            testMatch: /f37-ai-discoverability\.spec\.ts/,
            grepInvert: F37_CUSTOM_DOMAIN_TEST,
            use: {
                ...devices['Desktop Chrome'],
                storageState: undefined,
            },
            dependencies: ['setup'],
        },
        // F37 auth is used only to discover the account's sole site. The
        // storefront assertions themselves run in an unauthenticated context.
        {
            name: 'f37-storefront-regression',
            testDir: './tests',
            testMatch: /f37-schema-rich-local-markup\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: undefined,
            },
            dependencies: hasE2EAccount ? ['setup'] : [],
        },
        // US-F37-04 exercises the authenticated Dashboard → Editor flow.
        // The spec validates its own account-owned fixture and fails fast when
        // the required staging credentials or fixture shape are unavailable.
        {
            name: 'f37-seo-health-regression',
            testDir: './tests',
            testMatch: /f37-local-seo-score-checklist\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        // GH-1757 is an authenticated manual/local-only acceptance gate. Keep
        // this exact-spec project out of CI workflow selection.
        {
            name: 'gh-1757-local-business',
            testDir: './tests',
            testMatch: /gh-1757-local-business-settings\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'gh-1640-performance',
            testDir: './tests',
            testMatch: /gh-1640-performance\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        // GH-1687: authenticated category-management flow that verifies the
        // Parent Category dropdown follows tree preorder instead of API order.
        {
            name: 'gh-1687-category-order',
            testDir: './tests',
            testMatch: /category-management-rework\.spec\.ts/,
            grep: /\[TC-F08-05-40\]/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'gh-1734-self-delivery',
            testDir: './tests',
            testMatch: /gh-1734-self-delivery-complete\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'f40-qa-ingest',
            testDir: './tests',
            testMatch: /f40-qa-ingest\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        // F40-03 runs only an allow-listed spec selected by the server-owned
        // dispatch ledger. It intentionally has no broad tests/ fallback.
        {
            name: 'f40-targeted-smoke',
            testDir: './tests/targeted-smoke',
            testMatch: /\.smoke\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                // The fixture endpoint is deliberately admin-authenticated. Public
                // storefront assertions create their own clean browser context.
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'f40-project-health',
            testDir: './tests',
            testMatch: /f40-project-health\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'f40-findings',
            testDir: './tests',
            testMatch: /f40-findings\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'f40-github-issues',
            testDir: './tests',
            testMatch: /f40-github-issues\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], storageState: undefined },
        },
        // Browser-level boundary tests for every server endpoint introduced by
        // US-F40-03. They deliberately use no privileged secret.
        {
            name: 'f40-targeted-smoke-api',
            testDir: './tests',
            testMatch: /f40-targeted-smoke-api\.spec\.ts/,
            use: { ...devices['Desktop Chrome'], storageState: undefined },
        },
        // GH-1684: desktop keeps its native PDF viewer while real mobile browser
        // profiles exercise the canvas path (including WebKit soft-mask images).
        {
            name: 'shipping-label-regression',
            testDir: './tests',
            testMatch: /f36-print-label-mobile\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'shipping-label-narrow-desktop',
            testDir: './tests',
            testMatch: /f36-print-label-mobile\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 800, height: 900 },
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'shipping-label-android',
            testDir: './tests',
            testMatch: /f36-print-label-mobile\.spec\.ts/,
            use: {
                ...devices['Pixel 7'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'shipping-label-mobile-safari',
            testDir: './tests',
            testMatch: /f36-print-label-mobile\.spec\.ts/,
            use: {
                ...devices['iPhone 13'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'shipping-label-edge-ios',
            testDir: './tests',
            testMatch: /f36-print-label-mobile\.spec\.ts/,
            use: {
                ...devices['iPhone 13'],
                // Edge on iOS is still WebKit, but identifies itself with EdgiOS.
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/128.0 Mobile/15E148 Safari/605.1.15',
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'shipping-label-ipad-webkit',
            testDir: './tests',
            testMatch: /f36-print-label-mobile\.spec\.ts/,
            use: {
                ...devices['iPad Mini'],
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'shipping-label-ipad-landscape',
            testDir: './tests',
            testMatch: /f36-print-label-mobile\.spec\.ts/,
            use: {
                ...devices['iPad Mini'],
                viewport: { width: 1024, height: 768 },
                // iPadOS "Request Desktop Website" reports a Macintosh UA.
                // hasTouch/maxTouchPoints from the device descriptor must still select canvas.
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
                storageState: './e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
    ],
})
