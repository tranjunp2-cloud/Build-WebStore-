import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

test('[TC-F35.M59] product selection preserves source semantics in the storefront', async () => {
    test.setTimeout(180000)
    const { stdout } = await promisify(execFile)(process.execPath, ['--require', './scripts/seed-preload.cjs', '--import', 'tsx', 'scripts/tests/pw1-product-listing.ts'], { timeout: 170000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, PAYLOAD_PUSH_SCHEMA: 'false' } })
    expect(stdout).toContain('PASS: independent blocks, fixed order, stock/category/site scope, stable random pagination')
})
