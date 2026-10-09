import {test,expect} from '@playwright/test'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'

// The fixture runner performs real browser navigation and API assertions against local DB.
// It creates a separate tenant/site/account and cleans them in finally, without AI calls.
test('[TC-F35.M44] BE category mapping filters the native storefront', async () => {
    test.setTimeout(120000)
    const {stdout}=await promisify(execFile)(process.execPath,['--require','./scripts/seed-preload.cjs','--import','tsx','scripts/tests/pw1-category-mapping.ts'],{timeout:110000,maxBuffer:2*1024*1024})
    expect(stdout).toContain('native API returned only matching product')
})
