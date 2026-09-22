import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { execFileSync } from 'node:child_process'
import { SignJWT } from 'jose'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

test('[TC-F42-PRODUCT-PAGING] imported local store exposes all 307 products and searches beyond first 100', async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'f42-products-local', 'Dedicated local acceptance config only')
    // Arrange: read-only acceptance on the explicitly imported local Store 636.
    // A short-lived local test session exercises real server auth and tenant ACLs;
    // this test does not test login/OTP and never sends mail or modifies products.
    expect(baseURL).toBe('http://localhost:3005')
    const database = new URL(process.env.DATABASE_URI ?? '')
    expect(['localhost', '127.0.0.1']).toContain(database.hostname)
    expect(database.pathname).toBe('/primeweb')
    // Compose may override the host .env.local signing key. Keep it in memory only.
    const secret = execFileSync('docker', ['exec', 'primeweb-app', 'node', '-e', 'process.stdout.write(process.env.PAYLOAD_SECRET || "")'], { encoding: 'utf8' })
    if (!secret) throw new Error('Local session signing key required')
    const pool = new Pool({ connectionString: database.href })
    try {
        const count = await pool.query('SELECT count(*)::int AS count FROM products WHERE tenant_id=1282 AND deleted_at IS NULL')
        expect(count.rows[0].count).toBe(307)
        const oldest = await pool.query<{ sku: string }>('SELECT sku FROM products WHERE tenant_id=1282 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 1')
        const token = await new SignJWT({ id: 1354, collection: 'users', mfa_verified: true })
            .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(secret))
        await context.addCookies([{ name: 'payload-token', value: token, url: baseURL!, httpOnly: true, sameSite: 'Lax' }])
        // Act: real browser -> server action -> Payload/Postgres.
        await page.goto('/products')
        await expect(page.locator('table tbody tr')).toHaveCount(10)
        await expect(page.getByRole('tab', { name: /All.*307/ })).toBeVisible()
        await page.locator('button:visible').filter({ hasText: /^31$/ }).click()
        // Assert: last page is reachable and contains the final seven records.
        await expect(page.locator('table tbody tr')).toHaveCount(7)
        const search = page.locator('input[placeholder*="Search"]:visible').first()
        await search.fill(oldest.rows[0].sku)
        await expect(page.locator('table tbody tr')).toHaveCount(1)
        await expect(page.locator('table tbody')).toContainText(oldest.rows[0].sku)
        await search.fill('f42-definitely-no-product-matches-this-search')
        await expect(page.locator('table tbody tr')).toHaveCount(0)
        await search.fill('')
        await expect(page.locator('table tbody tr')).toHaveCount(10)
    } finally {
        await pool.end()
    }
})
