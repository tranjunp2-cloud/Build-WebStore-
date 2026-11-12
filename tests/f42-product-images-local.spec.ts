import { expect, test, request } from '@playwright/test'
import { Pool } from 'pg'
import { SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })

test('[TC-F42-076] editing eight historical images preserves them and normal writes cannot add a sixth', async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'f42-products-local', 'Dedicated local acceptance config only')
    expect(baseURL).toBe('http://localhost:3005')
    const database = new URL(process.env.DATABASE_URI ?? '')
    expect(['localhost', '127.0.0.1']).toContain(database.hostname)
    expect(database.pathname).toBe('/primeweb')
    // The REST checks sign in as a local super-admin: Payload REST refuses a tenant user's password-step token
    // (TC-PERF-142) and never accepts the OTP session, while a super-admin still signs in to it with a password.
    // The image-limit validator does not depend on the role.
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminEmail || !adminPassword) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD (a local super-admin) are required')
    const secret = execFileSync('docker', ['exec', 'primeweb-app', 'node', '-e', 'process.stdout.write(process.env.PAYLOAD_SECRET || String())'], { encoding: 'utf8' })
    const pool = new Pool({ connectionString: database.href })
    const api = await request.newContext({ baseURL })
    let productId: number | undefined
    try {
        // Arrange: isolated temporary draft; no existing product or migration claim is edited.
        const media = await pool.query<{ image_id: number }>('SELECT DISTINCT i.image_id FROM products_images i JOIN products p ON p.id=i._parent_id WHERE p.tenant_id=1282 AND i.image_id IS NOT NULL ORDER BY i.image_id LIMIT 9')
        expect(media.rowCount).toBe(9)
        const category = await pool.query<{ id: number; site_id: number }>('SELECT id,site_id FROM categories WHERE tenant_id=1282 ORDER BY id LIMIT 1')
        const key = `f42-image-limit-${randomUUID().slice(0, 24)}`
        const seeded = await pool.query<{ id: number }>("INSERT INTO products(tenant_id,site_id,name,slug,sku,price,inventory,currency,weight,status,has_variants) VALUES(1282,$1,'Historical image fixture',$2,$2,10,1,'MYR',1,'draft',false) RETURNING id", [category.rows[0].site_id, key])
        productId = seeded.rows[0].id
        for (const [index, image] of media.rows.slice(0, 8).entries()) await pool.query('INSERT INTO products_images(_order,_parent_id,id,image_id,alt) VALUES($1,$2,$3,$4,$5)', [index + 1, productId, randomUUID(), image.image_id, `Historical image ${index + 1}`])
        await pool.query("INSERT INTO products_rels(parent_id,path,categories_id) VALUES($1,'category',$2)", [productId, category.rows[0].id])
        const token = await new SignJWT({ id: 1354, collection: 'users', mfa_verified: true }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(secret))
        await context.addCookies([{ name: 'payload-token', value: token, url: baseURL!, httpOnly: true, sameSite: 'Lax' }])
        // Act: save an unrelated field through the real browser edit form.
        await page.goto(`/products/${productId}`)
        await expect(page.getByText('Existing extra images are preserved.', { exact: false })).toBeVisible()
        await page.locator('input[name="name"]').fill('Historical gallery preserved')
        await page.locator('button[type="submit"]').click()
        await page.waitForURL(/\/products$/, { timeout: 30_000 })
        // Assert: all eight image relationships survive the form and server validators.
        const gallery = await pool.query<{ image_id: number }>('SELECT image_id FROM products_images WHERE _parent_id=$1 ORDER BY _order', [productId])
        expect(gallery.rows.map(row => row.image_id)).toEqual(media.rows.slice(0, 8).map(row => row.image_id))
        // REST uses Payload's native session, separate from the browser MFA session.
        // Credentials stay in memory; tracing and request-body logging are disabled.
        const login = await api.post('/api/users/login', { data: { email: adminEmail, password: adminPassword } })
        expect(login.status()).toBe(200)
        const admin = await login.json() as { token?: string; user?: { roles?: string[] } }
        expect(admin.user?.roles, 'ADMIN_EMAIL must be a super-admin').toContain('super-admin')
        const headers = { Authorization: `JWT ${admin.token}` }
        const requestImages = (count: number) => media.rows.slice(0, count).map(row => ({ image: row.image_id, alt: 'Historical image' }))
        const replace = await api.patch(`/api/products/${productId}`, { headers, data: { images: [...requestImages(7), { image: media.rows[8].image_id }] } })
        expect(replace.status()).toBe(400)
        const remove = await api.patch(`/api/products/${productId}`, { headers, data: { images: requestImages(5) } })
        expect(remove.status()).toBe(200)
        const increase = await api.patch(`/api/products/${productId}`, { headers, data: { images: requestImages(6), context: { migrationProfile: 'pw1-json-v1' } } })
        expect(increase.status()).toBe(400)
        const remaining = await pool.query('SELECT count(*)::int AS count FROM products_images WHERE _parent_id=$1', [productId])
        expect(remaining.rows[0].count).toBe(5)
    } finally {
        // Delete only this test-created fixture, never any migrated product.
        if (productId !== undefined) await pool.query('DELETE FROM products WHERE id=$1 AND tenant_id=1282 AND slug LIKE $2', [productId, 'f42-image-limit-%'])
        await api.dispose()
        await pool.end()
    }
})
