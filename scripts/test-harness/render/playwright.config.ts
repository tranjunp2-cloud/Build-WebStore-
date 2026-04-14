/**
 * Playwright config for AI gen test harness rendering (Phase 03).
 *
 * Standalone from root playwright.config.ts:
 *  - Different testDir (only the harness spec)
 *  - No auth dependencies (no setup project, no storageState)
 *  - Independent baseURL and HTML report path so it never collides with e2e
 *
 * Intended invocation:
 *   npm run harness:gen  # writes matrix.json
 *   ENABLE_HARNESS=1 npm run dev &  # boot dev server with harness route
 *   npx wait-on http://localhost:3000
 *   ENABLE_HARNESS_ROUTE=1 npm run harness:render
 */

import { defineConfig, devices } from '@playwright/test'
import * as path from 'node:path'

const baseURL = process.env.HARNESS_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: path.resolve(__dirname),
  testMatch: /harness\.spec\.ts/,
  fullyParallel: false,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: path.resolve(__dirname, '../../../.harness-out/playwright-report'),
        open: 'never',
      },
    ],
  ],
  outputDir: path.resolve(__dirname, '../../../.harness-out/test-results'),
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'off', // we manage screenshots ourselves
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'harness-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'harness-mobile',
      // Don't spread iPhone 13 profile — its built-in viewport conflicts with
      // our override and causes the test runner to crash before screenshot.
      // Just declare mobile-flavoured props directly.
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
