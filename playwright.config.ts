import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false, // Run sequentially — tests share auth state
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 1,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
    timeout: 60_000, // 60s per test — some flows are slow (AI builder)
    expect: {
        timeout: 10_000, // 10s for assertions
    },
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
        actionTimeout: 15_000,
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
