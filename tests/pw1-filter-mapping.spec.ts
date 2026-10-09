import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
test('[TC-F35.M60] migrated filters work on desktop and mobile', async () => {
    test.setTimeout(180000)
    const { stdout } = await promisify(execFile)(process.execPath, ['--require', './scripts/seed-preload.cjs', '--import', 'tsx', 'scripts/tests/pw1-filter-mapping.ts'], { timeout: 170000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, PAYLOAD_PUSH_SCHEMA: 'false' } })
    expect(stdout).toContain('PASS: desktop/mobile criteria and tenant-scoped blog category filtering')
})
