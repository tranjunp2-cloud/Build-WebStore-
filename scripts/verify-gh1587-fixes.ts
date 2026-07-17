/**
 * GH-1587 cross-tenant isolation — manual verification script.
 *
 * Re-runs live attacks against real local Postgres data for the tenant-
 * isolation fixes in this branch. Each check creates its own throwaway data,
 * attacks it, asserts the attack is blocked, then cleans up after itself.
 * Safe to run repeatedly against a local DB.
 *
 * Usage: npx tsx --require ./scripts/seed-preload.cjs scripts/verify-gh1587-fixes.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

let passed = 0
let failed = 0

function report(label: string, ok: boolean, detail?: string) {
    if (ok) {
        passed++
        console.log(`✅ ${label}`)
    } else {
        failed++
        console.log(`❌ ${label}${detail ? ' — ' + detail : ''}`)
    }
}

async function main() {
    const payload = await getPayload({ config })

    const tenantsRes = await payload.find({ collection: 'tenants', limit: 2, depth: 0 })
    if (tenantsRes.docs.length < 2) {
        console.error('Need at least 2 tenants in local DB to run this script.')
        process.exit(1)
    }
    const [tenantA, tenantB] = tenantsRes.docs
    const siteA = (await payload.find({ collection: 'sites', where: { tenant: { equals: tenantA.id } }, limit: 1 })).docs[0]
    const siteB = (await payload.find({ collection: 'sites', where: { tenant: { equals: tenantB.id } }, limit: 1 })).docs[0]
    const authorId = (await payload.find({ collection: 'users', limit: 1 })).docs[0]?.id

    const attackerUser = { id: 'attacker', roles: ['owner'], tenants: [{ tenant: tenantA.id }] }

    console.log('\n=== Bug B: anonymous REST read blocked (Categories/Products/Blogs/BlogCategories) ===')
    for (const collection of ['categories', 'products', 'blogs', 'blog_categories'] as const) {
        try {
            const res = await payload.find({ collection, limit: 1, overrideAccess: false })
            report(`Bug B — ${collection} anonymous read`, res.docs.length === 0, `returned ${res.docs.length} docs to anonymous caller`)
        } catch {
            report(`Bug B — ${collection} anonymous read`, true)
        }
    }

    console.log('\n=== Bug A: Categories parent-field cross-tenant IDOR ===')
    {
        const foreignCat = await payload.create({
            collection: 'categories', overrideAccess: true,
            data: { tenant: tenantB.id, site: siteB.id, name: 'VERIFY-FOREIGN-CAT' },
        })
        const myCat = await payload.create({
            collection: 'categories', overrideAccess: true,
            data: { tenant: tenantA.id, site: siteA.id, name: 'VERIFY-MY-CAT' },
        })
        try {
            await payload.update({
                collection: 'categories', id: myCat.id, user: attackerUser as any, overrideAccess: false,
                data: { parent: foreignCat.id },
            })
            report('Bug A — cross-tenant parent set', false, 'update succeeded, should have been rejected')
        } catch {
            report('Bug A — cross-tenant parent set', true)
        }
        await payload.delete({ collection: 'categories', id: foreignCat.id, overrideAccess: true })
        await payload.delete({ collection: 'categories', id: myCat.id, overrideAccess: true })
    }

    console.log('\n=== Bug C/D: tenant/site field spoof (Categories + Products) ===')
    for (const collection of ['categories', 'products'] as const) {
        const data: Record<string, unknown> = collection === 'categories'
            ? { tenant: tenantA.id, site: siteA.id, name: 'VERIFY-SPOOF-TEST' }
            : { tenant: tenantA.id, site: siteA.id, name: 'VERIFY-SPOOF-TEST', sku: `VERIFY-${Date.now()}`, price: 100 }
        const mine = await payload.create({ collection, overrideAccess: true, data })
        const updated = await payload.update({
            collection, id: mine.id, user: attackerUser as any, overrideAccess: false,
            data: { tenant: tenantB.id },
        })
        const finalTenant = typeof updated.tenant === 'object' ? (updated.tenant as any).id : updated.tenant
        report(`Bug ${collection === 'categories' ? 'C' : 'D'} — ${collection} tenant field spoof`, String(finalTenant) === String(tenantA.id), `tenant ended up as ${finalTenant}, expected ${tenantA.id}`)
        await payload.delete({ collection, id: mine.id, overrideAccess: true })
    }

    console.log('\n=== Bug E: Blogs write-path IDOR (saveBlogAction + 5 siblings + bulkDelete) ===')
    {
        const victimBlog = await payload.create({
            collection: 'blogs', overrideAccess: true,
            data: { tenant: tenantB.id, site: siteB.id, title: 'VERIFY-VICTIM-BLOG', slug: 'verify-victim-' + Date.now(), content: 'x', status: 'published', author: authorId },
        })
        try {
            await payload.update({
                collection: 'blogs', id: victimBlog.id, user: attackerUser as any, overrideAccess: false,
                data: { title: 'HACKED' },
            })
            report('Bug E — cross-tenant blog update (overrideAccess:false)', false, 'update succeeded')
        } catch {
            report('Bug E — cross-tenant blog update (overrideAccess:false)', true)
        }

        // Simulate the actions' own tenant-unresolvable fail-open scenario: with a real
        // Payload access-control call this is already covered above; this section documents
        // the specific `blog/actions.ts` logic fix (isSuperAdmin + fail-closed), verified via
        // the unit tests in blog-actions-f17-fixes.test.ts (TC-F17-SEC-03b through 09c).
        console.log('   (saveBlogAction / deleteBlogAction / updateBlogStatusAction / updateBlogCategoryAction /')
        console.log('    deleteBlogCategoryAction / getBlogByIdAction / bulkDeleteBlogsAction fail-open-when-')
        console.log('    tenant-unresolvable fixes are Server Actions tied to request context — verified via')
        console.log('    src/__tests__/unit/actions/blog-actions-f17-fixes.test.ts, TC-F17-SEC-03b..09c.)')

        await payload.delete({ collection: 'blogs', id: victimBlog.id, overrideAccess: true })
    }

    console.log('\n=== Blog collections: tenant/site field spoof blocked on generic Payload API ===')
    {
        const mine = await payload.create({
            collection: 'blogs',
            overrideAccess: true,
            data: {
                tenant: tenantA.id,
                site: siteA.id,
                title: `VERIFY-MY-BLOG-${Date.now()}`,
                slug: `verify-my-blog-${Date.now()}`,
                content: 'x',
                status: 'draft',
                author: authorId,
            },
        })
        const spoofedCreate = await payload.create({
            collection: 'blogs',
            user: attackerUser as any,
            overrideAccess: false,
            data: {
                tenant: tenantB.id,
                site: siteB.id,
                title: `VERIFY-SPOOF-CREATE-${Date.now()}`,
                slug: `verify-spoof-create-${Date.now()}`,
                content: 'x',
                status: 'draft',
                author: authorId,
            },
        })
        const spoofedCreateTenant = typeof spoofedCreate.tenant === 'object' ? spoofedCreate.tenant.id : spoofedCreate.tenant
        const spoofedCreateSite = typeof spoofedCreate.site === 'object' ? spoofedCreate.site.id : spoofedCreate.site
        report(
            'Blogs create — spoofed tenant/site forced to actor ownership',
            String(spoofedCreateTenant) === String(tenantA.id) && String(spoofedCreateSite) === String(siteA.id),
            `create landed as tenant=${spoofedCreateTenant}, site=${spoofedCreateSite}`,
        )

        const updated = await payload.update({
            collection: 'blogs',
            id: mine.id,
            user: attackerUser as any,
            overrideAccess: false,
            data: { tenant: tenantB.id, site: siteB.id },
        })
        const finalTenant = typeof updated.tenant === 'object' ? updated.tenant.id : updated.tenant
        const finalSite = typeof updated.site === 'object' ? updated.site.id : updated.site
        report(
            'Blogs update — spoofed tenant/site stays in actor tenant',
            String(finalTenant) === String(tenantA.id) && String(finalSite) === String(siteA.id),
            `update landed as tenant=${finalTenant}, site=${finalSite}`,
        )

        const spoofedCategoryCreate = await payload.create({
            collection: 'blog_categories',
            user: attackerUser as any,
            overrideAccess: false,
            data: {
                tenant: tenantB.id,
                name: `VERIFY-SPOOF-CAT-${Date.now()}`,
                slug: `verify-spoof-cat-${Date.now()}`,
            },
        })
        const spoofedCategoryCreateTenant = typeof spoofedCategoryCreate.tenant === 'object'
            ? spoofedCategoryCreate.tenant.id
            : spoofedCategoryCreate.tenant
        report(
            'BlogCategories create — spoofed tenant forced to actor ownership',
            String(spoofedCategoryCreateTenant) === String(tenantA.id),
            `create landed as tenant=${spoofedCategoryCreateTenant}`,
        )

        const myCategory = await payload.create({
            collection: 'blog_categories',
            overrideAccess: true,
            data: {
                tenant: tenantA.id,
                name: `VERIFY-MY-CAT-${Date.now()}`,
                slug: `verify-my-cat-${Date.now()}`,
            },
        })
        const updatedCategory = await payload.update({
            collection: 'blog_categories',
            id: myCategory.id,
            user: attackerUser as any,
            overrideAccess: false,
            data: { tenant: tenantB.id },
        })
        const finalCategoryTenant = typeof updatedCategory.tenant === 'object'
            ? updatedCategory.tenant.id
            : updatedCategory.tenant
        report(
            'BlogCategories update — spoofed tenant stays in actor tenant',
            String(finalCategoryTenant) === String(tenantA.id),
            `update landed as tenant=${finalCategoryTenant}`,
        )

        await payload.delete({ collection: 'blogs', id: mine.id, overrideAccess: true })
        await payload.delete({ collection: 'blogs', id: spoofedCreate.id, overrideAccess: true })
        await payload.delete({ collection: 'blog_categories', id: spoofedCategoryCreate.id, overrideAccess: true })
        await payload.delete({ collection: 'blog_categories', id: myCategory.id, overrideAccess: true })
    }

    console.log(`\n${'='.repeat(60)}\n${passed} passed, ${failed} failed\n`)
    process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
