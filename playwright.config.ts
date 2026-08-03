import { defineConfig, devices } from '@playwright/test'

const isStaging = process.env.BASE_URL?.includes('dev.ecommercehub')

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
        // tests/*.spec.ts and do not need the authenticated E2E setup project.
        {
            name: 'storefront-regression',
            testDir: './tests',
            testMatch: /(cart-drawer|f37-ai-discoverability)\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: undefined,
            },
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
