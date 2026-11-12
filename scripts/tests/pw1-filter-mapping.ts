/** TC-F35.M60: real local DB fixtures and browser; never calls AI. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import { Client } from 'pg'
import { chromium } from '@playwright/test'
import config from '@payload-config'

async function main() {
    const uri = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!uri || !['localhost', '127.0.0.1'].includes(new URL(uri).hostname)) throw Error('Local DB only')
    const payload = await getPayload({ config })
    const client = new Client({ connectionString: uri })
    await client.connect()
    const browser = await chromium.launch({ headless: true, channel: 'chrome' })
    const nonce = randomUUID(), slug = `filter-qa-${nonce}`
    let tenantId: number | undefined, siteId: number | undefined
    const categoryIds: number[] = [], productIds: number[] = [], blogIds: number[] = [], blogCategoryIds: number[] = []
    try {
        tenantId = Number((await payload.create({ collection: 'tenants', data: { name: 'Filter QA', slug, plan: 'free' } })).id)
        siteId = Number((await payload.create({ collection: 'sites', data: { tenant: tenantId, name: 'Filter QA', status: 'draft', generationStatus: 'none', siteType: 'ecommerce', locale: 'en', generationLocale: 'en' } })).id)
        const author = (await payload.find({ collection: 'users', limit: 1, depth: 0 })).docs[0]
        if (!author) throw Error('Local fixture requires an existing author')
        for (const [i, name] of ['Alpha', 'Beta'].entries()) {
            const cat = await payload.create({ collection: 'categories', data: { tenant: tenantId, site: siteId, name } }); categoryIds.push(Number(cat.id))
            productIds.push(Number((await payload.create({ collection: 'products', data: { tenant: tenantId, site: siteId, name: `Filter product ${name}`, slug: `${slug}-${i}`, price: 10 + i * 10, inventory: 5, category: cat.id, status: 'draft' } })).id))
            const blogCat = await payload.create({ collection: 'blog_categories', data: { tenant: tenantId, name, slug: `${slug}-${name.toLowerCase()}`, status: 'active' } }); blogCategoryIds.push(Number(blogCat.id))
            blogIds.push(Number((await payload.create({ collection: 'blogs', data: { tenant: tenantId, site: siteId, author: author.id, category: blogCat.id, title: `Filter article ${name}`, slug: `${slug}-article-${i}`, status: 'draft' } })).id))
        }
        await client.query("UPDATE products SET status='active' WHERE id=ANY($1::int[])", [productIds])
        await client.query("UPDATE blogs SET status='published' WHERE id=ANY($1::int[])", [blogIds])
        await payload.create({ collection: 'pages', data: { site: siteId, title: 'Home', seo: { title: 'Filter QA', description: 'Isolated filter mapping fixture' }, slug: 'home', isHomepage: true, _status: 'published', layout: [
            { blockType: 'products-grid', headline: 'Products', limit: 12, showCategoryFilter: true, filterControls: { category: true, price: false, search: false, attributes: false } },
            { blockType: 'blog-list', headline: 'Articles', limit: 12, showCategoryFilter: true },
        ] } })
        await payload.update({ collection: 'sites', id: siteId, data: { status: 'published' } })
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
        await page.goto(`http://localhost:3000/sites/${slug}`)
        await page.getByText('Filter product Alpha', { exact: true }).first().waitFor()
        await page.getByText('Filter article Beta', { exact: true }).first().waitFor()
        assert.equal(await page.getByText('Price', { exact: true }).count(), 0)
        assert.equal(await page.getByPlaceholder('Search your keyword...').count(), 0)
        await page.getByRole('combobox', { name: 'Article category' }).click()
        const scrollBefore = await page.evaluate(() => window.scrollY)
        await page.getByRole('option', { name: 'Alpha', exact: true }).click()
        await page.waitForURL(/blogCategory=/)
        await page.waitForFunction(() => !document.body.textContent?.includes('Filter article Beta'))
        assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - scrollBefore) < 10, 'Category filtering should preserve scroll')
        assert.equal(await page.getByText('Filter article Alpha', { exact: true }).count(), 1)
        assert.equal(await page.getByText('Filter product Beta', { exact: true }).count(), 1)
        await page.getByRole('combobox', { name: 'Article category' }).click()
        await page.getByRole('option', { name: 'All categories', exact: true }).click()
        await page.getByText('Filter article Beta', { exact: true }).waitFor()
        await page.setViewportSize({ width: 390, height: 844 })
        await page.getByRole('button', { name: 'Filters', exact: true }).click()
        const dialog = page.getByRole('dialog')
        await dialog.waitFor()
        assert.equal(await dialog.getByText('Alpha', { exact: true }).count(), 1)
        assert.equal(await dialog.getByRole('slider').count(), 0)
        assert.equal(await dialog.locator('input[type=search]').count(), 0)
        console.log('PASS: desktop/mobile criteria and tenant-scoped blog category filtering')
    } finally {
        await browser.close()
        if (siteId) await payload.delete({ collection: 'pages', where: { site: { equals: siteId } } })
        for (const id of blogIds) await payload.delete({ collection: 'blogs', id })
        for (const id of blogCategoryIds) await payload.delete({ collection: 'blog_categories', id })
        for (const id of productIds) await payload.delete({ collection: 'products', id })
        for (const id of categoryIds) await payload.delete({ collection: 'categories', id })
        if (siteId) { await client.query('DELETE FROM analytics WHERE site_id=$1', [siteId]); await payload.delete({ collection: 'sites', id: siteId }) }
        if (tenantId) await payload.delete({ collection: 'tenants', id: tenantId })
        await client.end()
        await payload.destroy()
    }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
