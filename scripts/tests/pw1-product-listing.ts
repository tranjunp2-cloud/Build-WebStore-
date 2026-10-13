/** TC-F35.M59: isolated local fixtures, real storefront browser + API, no AI. */
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
    const nonce = randomUUID(), slug = `listing-qa-${nonce}`
    let tenantId: number | undefined, siteId: number | undefined
    const categoryIds: number[] = [], productIds: number[] = []
    try {
        tenantId = Number((await payload.create({ collection: 'tenants', data: { name: 'Listing QA', slug, plan: 'free' } })).id)
        siteId = Number((await payload.create({ collection: 'sites', data: { tenant: tenantId, name: 'Listing QA', status: 'draft', generationStatus: 'none', siteType: 'ecommerce', locale: 'en' } })).id)
        for (const name of ['A', 'B']) categoryIds.push(Number((await payload.create({ collection: 'categories', data: { tenant: tenantId, site: siteId, name } })).id))
        for (let i = 0; i < 5; i++) productIds.push(Number((await payload.create({ collection: 'products', data: {
            tenant: tenantId, site: siteId, name: `Listing QA ${i}`, slug: `qa-${nonce}-${i}`, price: 10, inventory: i === 1 ? 0 : 5, status: 'draft', category: categoryIds[i % 2],
            ...(i === 4 ? { inventory: 0, hasVariants: true, variants: [{ name: 'Available', price: 10, stock: 5 }] } : {}),
        } })).id))
        await client.query("UPDATE products SET status='active' WHERE id=ANY($1::int[])", [productIds])
        await payload.create({ collection: 'pages', data: { site: siteId, title: 'Home', seo: { title: 'Listing QA', description: 'Isolated listing fixture' }, slug: 'home', isHomepage: true, _status: 'published', layout: [
            { blockType: 'products-grid', headline: 'Fixed A', selectionMode: 'fixed', selectedProductIds: [String(productIds[2]), String(productIds[0])], limit: 2 },
            { blockType: 'products-grid', headline: 'Fixed B', selectionMode: 'fixed', selectedProductIds: [String(productIds[3])], limit: 1 },
        ] } })
        await payload.update({ collection: 'sites', id: siteId, data: { status: 'published' } })
        const page = await browser.newPage()
        await page.goto(`http://localhost:3000/sites/${slug}`)
        await page.getByText('Listing QA 2', { exact: true }).first().waitFor()
        assert.equal(await page.getByText('Listing QA 1', { exact: true }).count(), 0)
        assert.equal(await page.getByText('Listing QA 4', { exact: true }).count(), 0)
        async function query(params: Record<string, string>, ids: number[] = []) {
            const search = new URLSearchParams({ site: String(siteId), ...params })
            ids.forEach(id => search.append('productId', String(id)))
            return page.evaluate(async path => {
                const response = await fetch(path)
                return { status: response.status, body: await response.json() }
            }, `/api/storefront/products?${search}`)
        }
        const fixed = await query({ selectionMode: 'fixed', limit: '2' }, [productIds[3], productIds[0], productIds[2]])
        assert.equal(fixed.status, 200)
        assert.deepEqual(fixed.body.docs.map((p: { id: number }) => p.id), [productIds[3], productIds[0]])
        const next = await query({ selectionMode: 'fixed', limit: '2', page: '2' }, [productIds[3], productIds[0], productIds[2]])
        assert.deepEqual(next.body.docs.map((p: { id: number }) => p.id), [productIds[2]])
        assert.equal((await query({ selectionMode: 'fixed' })).body.totalDocs, 0)
        const inStock = await query({ includeOutOfStock: 'false' })
        assert.equal(inStock.status, 200)
        assert.equal(inStock.body.totalDocs, 4)
        const scoped = await query({ selectionMode: 'fixed', fixedCategoryId: String(categoryIds[0]) }, [productIds[0], productIds[1]])
        assert.deepEqual(scoped.body.docs.map((p: { id: number }) => p.id), [productIds[0]])
        const foreign = await query({ selectionMode: 'fixed' }, [productIds[0], 7939])
        assert.deepEqual(foreign.body.docs.map((p: { id: number }) => p.id), [productIds[0]])
        const random1 = await query({ selectionMode: 'random', seed: 'browser-session', limit: '3' })
        const random2 = await query({ selectionMode: 'random', seed: 'browser-session', limit: '3', page: '2' })
        const repeat = await query({ selectionMode: 'random', seed: 'browser-session', limit: '3' })
        assert.deepEqual(random1.body.docs, repeat.body.docs)
        assert.equal(new Set([...random1.body.docs, ...random2.body.docs].map((p: { id: number }) => p.id)).size, 5)
        assert.equal((await query({ selectionMode: 'unknown' })).status, 400)
        console.log('PASS: independent blocks, fixed order, stock/category/site scope, stable random pagination')
    } finally {
        await browser.close()
        if (siteId) await payload.delete({ collection: 'pages', where: { site: { equals: siteId } } })
        for (const id of productIds) await payload.delete({ collection: 'products', id })
        for (const id of categoryIds) await payload.delete({ collection: 'categories', id })
        if (siteId) { await client.query('DELETE FROM analytics WHERE site_id=$1', [siteId]); await payload.delete({ collection: 'sites', id: siteId }) }
        if (tenantId) await payload.delete({ collection: 'tenants', id: tenantId })
        await client.end()
        await payload.destroy()
    }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
