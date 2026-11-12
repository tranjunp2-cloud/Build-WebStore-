import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://localhost:3005'

export default defineConfig({
    testDir: './tests', testMatch: /f42-(products-pagination|product-images)-local\.spec\.ts/,
    projects: [{ name: 'f42-products-local' }],
    workers: 1, retries: 0, timeout: 120_000, expect: { timeout: 30_000 }, reporter: 'list',
    use: {
        ...devices['Desktop Chrome'], baseURL, trace: 'off', screenshot: 'off', video: 'off',
        // Cookie-authenticated writes need a same-host Origin (TC-PERF-162); APIRequestContext sends none.
        extraHTTPHeaders: { Origin: new URL(baseURL).origin },
    },
})
