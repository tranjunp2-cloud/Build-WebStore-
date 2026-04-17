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
    ],
})
