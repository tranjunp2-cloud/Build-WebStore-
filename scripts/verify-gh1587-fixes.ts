/**
 * GH-1587 cross-tenant isolation — manual verification script.
 *
 * Re-runs live attacks against real local Postgres data for every bug fixed
 * on branch fix/category-tenant-isolation-security (Bugs A-F). Each check
 * creates its own throwaway data, attacks it, asserts the attack is blocked,
 * then cleans up after itself. Safe to run repeatedly against a local DB.
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
    const noTenantUser = { id: 'no-tenant-attacker', roles: ['owner'], tenants: [] }

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

    console.log('\n=== Bug F: Users.tenants self-grant ===')
    {
        const attacker = await payload.create({
            collection: 'users', overrideAccess: true,
            data: {
                email: `verify-gh1587-${Date.now()}@example.com`,
                password: 'ThrowawayPassw0rd!',
                firstName: 'Verify', lastName: 'GH1587',
                roles: ['tenant-owner'],
            },
        })
        const selfUser = { id: attacker.id, roles: attacker.roles ?? ['tenant-owner'], tenants: [] }
        const updated = await payload.update({
            collection: 'users', id: attacker.id, user: selfUser as any, overrideAccess: false,
            data: { tenants: [{ tenant: tenantB.id, role: 'owner', status: 'active' }] },
        })
        const gotTenantB = ((updated.tenants as any[]) ?? []).some(
            (t) => String(typeof t.tenant === 'object' ? t.tenant.id : t.tenant) === String(tenantB.id)
        )
        report('Bug F — self-grant tenant membership', !gotTenantB, `tenants after attack: ${JSON.stringify(updated.tenants)}`)
        await payload.delete({ collection: 'users', id: attacker.id, overrideAccess: true })
    }

    console.log(`\n${'='.repeat(60)}\n${passed} passed, ${failed} failed\n`)
    process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
