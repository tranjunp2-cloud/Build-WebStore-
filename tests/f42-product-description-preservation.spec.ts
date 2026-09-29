import { expect, test, request } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

test('[TC-F42-059] local product edit preserves rich text, reverted edits, and image-only documents', async ({ page, baseURL }) => {
  // Arrange: real local fixture API, authentication, media upload and collection API.
  expect(baseURL).toBe('http://localhost:3000')
  const database = new URL(process.env.DATABASE_URI ?? '')
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/pw1_gap_browser_\d+$/.test(database.pathname))
    throw new Error('A dedicated local pw1_gap_browser_<date> database is required')
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  const secret = process.env.E2E_SETUP_SECRET
  if (!email || !password || !secret) throw new Error('Local E2E credentials and setup secret are required')
  const provision = await page.request.post('/api/e2e/ensure-test-user', {
    headers: { Authorization: `Bearer ${secret}` },
    data: { email, password, tenantSlug: 'e2e-f42-rich-description', ssoCompletedSteps: [1, 2, 3] },
  })
  expect(provision.status(), 'Local fixture provisioning').toBe(200)
  const fixture = await provision.json() as { tenantId: number; siteId: number; categoryId: number }
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/verify-otp/)
  const digits = page.locator('input[inputmode="numeric"], input[data-otp="true"]')
  await expect(digits).toHaveCount(6)
  for (let i = 0; i < 6; i++) await digits.nth(i).fill('0')
  await page.waitForURL(/\/(dashboard|builder|onboarding)/)

  const upload = await page.request.post('/api/media/upload', {
    multipart: {
      file: { name: `f42-${randomUUID()}.png`, mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=', 'base64') },
      alt: 'Local F42 fixture',
    },
  })
  expect(upload.status(), 'Local media upload').toBe(200)
  const media = await upload.json() as { id: number }
  const uploadNode = { type: 'upload', version: 3, relationTo: 'media', value: media.id, fields: {}, id: '0123456789abcdef01234567', format: '' }
  const rich = {
    root: { type: 'root', version: 1, format: '', indent: 0, direction: 'ltr', children: [
      { type: 'paragraph', version: 1, format: '', indent: 0, direction: 'ltr', textFormat: 0, textStyle: '', children: [
        { type: 'text', version: 1, text: 'Original rich text', format: 1, style: 'color:red', detail: 0, mode: 'normal' },
      ] }, uploadNode,
    ] },
  }
  // Payload REST uses its native session; the browser keeps its MFA-verified session.
  const api = await request.newContext({ baseURL })
  const login = await api.post('/api/users/login', { data: { email, password } })
  expect(login.status()).toBe(200)
  const pool = new Pool({ connectionString: database.href })
  const productIds: number[] = []
  try {
    for (const imageOnly of [false, true]) {
      const sku = `f42-${randomUUID()}`
      // Seed the persisted document directly: this regression targets the real
      // dashboard save action, independently of Payload REST create hooks.
      const description = imageOnly ? { root: { ...rich.root, children: [uploadNode] } } : rich
      const seeded = await pool.query<{ id: number }>(`
        INSERT INTO products(tenant_id,site_id,name,slug,sku,price,inventory,currency,weight,status,has_variants,description)
        VALUES ($1,$2,$3,$4,$4,10,5,'MYR',1,'draft',false,$5::jsonb) RETURNING id
      `, [fixture.tenantId, fixture.siteId, 'F42 original product', sku, JSON.stringify(description)])
      const id = seeded.rows[0].id
      await pool.query('INSERT INTO products_images(_order,_parent_id,id,image_id,alt) VALUES (1,$1,$2,$3,$4)', [id, randomUUID(), media.id, 'Local fixture'])
      await pool.query('INSERT INTO products_rels(parent_id,path,categories_id) VALUES ($1,$2,$3)', [id, 'category', fixture.categoryId])
      productIds.push(id)
      const originalResponse = await api.get(`/api/products/${id}?depth=0`)
      expect(originalResponse.ok()).toBe(true)
      const original = await originalResponse.json() as { description: unknown }
      for (const revert of imageOnly ? [false] : [false, true]) {
        // Act: load fetched data, optionally edit/revert description, save another field.
        await page.goto(`/products/${id}`)
        const description = page.locator('textarea[name="description"]')
        await expect(description).toHaveValue(imageOnly ? '' : 'Original rich text')
        if (revert) {
          await description.fill('Temporary edit')
          await description.fill('Original rich text')
        }
        const name = `F42 preserved ${imageOnly ? 'image' : 'rich'} ${revert ? 'reverted' : 'unchanged'}`
        await page.locator('input[name="name"]').fill(name)
        await page.locator('button[type="submit"]').click()
        await page.waitForURL(/\/products$/)
        // Assert: real persisted rich JSON is unchanged, while the name update succeeded.
        const response = await api.get(`/api/products/${id}?depth=0`)
        expect(response.ok()).toBe(true)
        const saved = await response.json() as { name: string; description: unknown }
        expect(saved.name).toBe(name)
        expect(saved.description).toEqual(original.description)
      }
    }
  } finally {
    for (const id of productIds) await pool.query('DELETE FROM products WHERE id=$1 AND tenant_id=$2', [id, fixture.tenantId])
    await pool.end()
    await api.delete(`/api/media/${media.id}`)
    await api.dispose()
  }
})
