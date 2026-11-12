import { defineConfig, devices } from '@playwright/test'

// Dedicated local fixture database/server only. Never inherits a remote BASE_URL.
const baseURL = 'http://localhost:3000'

export default defineConfig({
  testDir: './tests',
  testMatch: /f42-product-description-preservation\.spec\.ts/,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    // Cookie-authenticated writes need a same-host Origin (TC-PERF-162); APIRequestContext sends none.
    extraHTTPHeaders: { Origin: new URL(baseURL).origin },
    trace: 'off', screenshot: 'off', video: 'off',
  },
})
