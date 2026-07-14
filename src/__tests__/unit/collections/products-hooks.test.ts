import { describe, it, expect, vi } from 'vitest'
import { Products } from '../../../collections/Products'
import { CollectionBeforeChangeHook } from 'payload'

describe('Products Collection Hooks (TC-F08)', () => {

    describe('beforeChangeHook (TC-F08-01-07, TC-F08-G-03)', () => {
        const hook = Products.hooks!.beforeChange![0] as CollectionBeforeChangeHook

        it('TC-F08-01-07: Automatically assigns tenant to the first available if not provided', async () => {
            const req = { 
                user: { tenants: [{ tenant: 'tenant-1' }] }, 
                payload: { find: vi.fn().mockResolvedValue({ docs: [{ id: 'site-1' }] }) } 
            } as any
            const result = await hook({ data: { name: 'Áo thun' }, req, operation: 'create' } as any)
            
            expect(result.tenant).toBe('tenant-1')
            expect(result.site).toBe('site-1')
        })

        it('TC-F08-G-03: Enforces IDOR by fetching only the matching tenant site (Access Policy)', async () => {
            const req = { 
                user: { tenants: [{ tenant: 'tenant-2' }] }, 
                payload: { find: vi.fn().mockResolvedValue({ docs: [{ id: 'site-2' }] }) } 
            } as any
            await hook({ data: { name: 'Sản phẩm 2' }, req, operation: 'create' } as any)
            
            expect(req.payload.find).toHaveBeenCalledWith(expect.objectContaining({
                where: { tenant: { equals: 'tenant-2' } }
            }))
        })
    })

    // ── TC-09.47: publishGateHook (code-review fix, PR #1500) ──────────────────
    // Adversarial review found the two Server Action gates (saveProductAction,
    // updateProductFieldAction) only fire when the incoming payload explicitly sets
    // `status:'active'` — editing an already-active product without touching `status` (exactly
    // what the edit form does on every save) skipped both, and Payload's default REST/GraphQL API
    // bypassed them outright. This collection-level beforeChange hook is the single source of
    // truth: it fires on every write path, keyed on the RESULTING status, not just the payload.
    describe('publishGateHook (TC-09.47)', () => {
        const hook = Products.hooks!.beforeChange![1] as CollectionBeforeChangeHook

        it('[TC-09.47] create with status:active and missing core fields → throws PUBLISH_BLOCKED', async () => {
            await expect(hook({
                data: { name: 'X', status: 'active' },
                operation: 'create',
            } as any)).rejects.toThrow(/PUBLISH_BLOCKED/)
        })

        it('[TC-09.47] create with status:active and all core fields present → does not throw', async () => {
            const data = { name: 'X', status: 'active', price: 100, sku: 'SKU-1', inventory: 5, weight: 500 }
            await expect(hook({ data, operation: 'create' } as any)).resolves.toEqual(data)
        })

        it('[TC-09.47] create with status omitted (draft default) → does not throw regardless of missing fields', async () => {
            await expect(hook({ data: { name: 'X' }, operation: 'create' } as any)).resolves.toBeDefined()
        })

        it('[TC-09.47] edit an existing ACTIVE product, status omitted, clearing sku/inventory/weight → throws PUBLISH_BLOCKED (closes the gap)', async () => {
            const originalDoc = { id: 1, status: 'active', price: 100, sku: 'SKU-1', inventory: 5, weight: 500 }
            await expect(hook({
                data: { sku: '', inventory: null, weight: 0 },
                originalDoc,
                operation: 'update',
            } as any)).rejects.toThrow(/PUBLISH_BLOCKED/)
        })

        it('[TC-09.47] edit an existing ACTIVE product touching only an unrelated field (description) → does not throw', async () => {
            // Regression guard: an active product missing core fields pre-dating this gate must
            // still be editable for unrelated content — the gate should not retroactively block
            // every write to a legacy-incomplete active product.
            const originalDoc = { id: 1, status: 'active', price: null, sku: '', inventory: null, weight: 0 }
            const data = { description: 'Updated copy' }
            await expect(hook({ data, originalDoc, operation: 'update' } as any)).resolves.toEqual(data)
        })

        it('[TC-09.52] Payload /admin panel full-document save (all fields re-sent unchanged) on a legacy-incomplete ACTIVE product, only description edited → does not throw (independent review fix)', async () => {
            // Payload's own admin panel submits the FULL document on every save, not a partial
            // diff — unlike the two Server Actions. A key-presence trigger (the original design)
            // would re-fire this gate on EVERY /admin save of a legacy-incomplete active product,
            // even when the human only edited `description`, since price/sku/inventory/weight are
            // always present in the full-document payload. Trigger must be value-CHANGED, not
            // value-PRESENT, against originalDoc.
            const originalDoc = {
                id: 1, status: 'active', price: null, sku: '', inventory: null, weight: 0,
                hasVariants: false, description: 'Old copy',
            }
            const data = {
                status: 'active', price: null, sku: '', inventory: null, weight: 0,
                hasVariants: false, description: 'Updated copy via /admin',
            }
            await expect(hook({ data, originalDoc, operation: 'update' } as any)).resolves.toEqual(data)
        })

        it('[TC-09.52] Payload /admin panel full-document save that DOES change a gate field (weight cleared) on an ACTIVE product → throws PUBLISH_BLOCKED', async () => {
            const originalDoc = { id: 1, status: 'active', price: 100, sku: 'SKU-1', inventory: 5, weight: 500, hasVariants: false }
            const data = { status: 'active', price: 100, sku: 'SKU-1', inventory: 5, weight: 0, hasVariants: false }
            await expect(hook({ data, originalDoc, operation: 'update' } as any)).rejects.toThrow(/PUBLISH_BLOCKED/)
        })

        it('[TC-09.47] soft-delete (deletedAt only) on a legacy-incomplete ACTIVE product → does not throw', async () => {
            // updateProductFieldAction always re-passes existing.variants/variantConfigs stripped of
            // their auto-managed `id` (Payload 3.79 workaround) even on a deletedAt-only call — the
            // hook must recognize the id-stripped content as UNCHANGED and not treat it as "variants
            // touched", or every soft-delete of a legacy-incomplete active variant product would break.
            const originalDoc = {
                id: 1, status: 'active', price: null, sku: '', inventory: null, weight: 0,
                variants: [{ id: 'row-1', sku: '', price: null, stock: null }],
            }
            const data = {
                deletedAt: '2026-07-03T00:00:00.000Z',
                variants: [{ sku: '', price: null, stock: null }], // id stripped, content identical
                variantConfigs: [],
            }
            await expect(hook({ data, originalDoc, operation: 'update' } as any)).resolves.toEqual(data)
        })

        it('[TC-09.47] direct saveProductAction-style call sends only a broken `variants` array on an ACTIVE product (no status/hasVariants key) → throws PUBLISH_BLOCKED (closes a bypass introduced by excluding variants from the trigger set)', async () => {
            const originalDoc = {
                id: 1, status: 'active', hasVariants: true, sku: 'BASE-SKU', weight: 500,
                variants: [{ id: 'row-1', sku: 'V-1', price: 100, stock: 5 }],
            }
            const data = { variants: [{ sku: '', price: null, stock: null }] }
            await expect(hook({ data, originalDoc, operation: 'update' } as any)).rejects.toThrow(/PUBLISH_BLOCKED/)
        })

        it('[TC-09.51] soft-delete on a legacy row where originalDoc.variants is null (not []), non-variant product → does not throw (adversarial review fix)', async () => {
            // updateProductFieldAction always calls stripIds(existing.variants), and stripIds(null)
            // === []. If normalizeVariantsForCompare treated non-array as a passthrough instead of
            // coercing to [] (like stripIds does), "[]" !== "null" would spuriously report
            // variantsChanged=true and re-fire the gate on this untouched soft-delete.
            const originalDoc = { id: 1, status: 'active', price: 100, sku: 'SKU-1', inventory: 5, weight: 500, variants: null }
            const data = { deletedAt: '2026-07-03T00:00:00.000Z', variants: [], variantConfigs: [] }
            await expect(hook({ data, originalDoc, operation: 'update' } as any)).resolves.toEqual(data)
        })

        it('[TC-09.47] edit a DRAFT product clearing core fields → does not throw (gate only applies to active)', async () => {
            const originalDoc = { id: 1, status: 'draft', price: 100, sku: 'SKU-1', inventory: 5, weight: 500 }
            const data = { sku: '' }
            await expect(hook({ data, originalDoc, operation: 'update' } as any)).resolves.toEqual(data)
        })

        it('[TC-09.47] toggle Draft → Active via updateProductFieldAction shape, existing doc missing weight → throws PUBLISH_BLOCKED', async () => {
            const originalDoc = { id: 1, status: 'draft', price: 100, sku: 'SKU-1', inventory: 5, variants: [], variantConfigs: [] }
            await expect(hook({
                data: { status: 'active', variants: [], variantConfigs: [] },
                originalDoc,
                operation: 'update',
            } as any)).rejects.toThrow(/PUBLISH_BLOCKED/)
        })
    })

    describe('Schema Validations (TC-F08-01)', () => {
        it('TC-F08-01-07: Default status for brand new products is draft', () => {
            const statusField = Products.fields.find((f: any) => f.name === 'status') as any
            expect(statusField).toBeDefined()
            expect(statusField.defaultValue).toBe('draft')
        })
    })

    describe('Access Control (TC-F08-G-03)', () => {
        it('TC-F08-G-03: Users can only read products matching their tenant', () => {
            const req = { user: { tenants: [{ tenant: 'tenant-1' }] } } as any
            const access = Products.access!.read!({ req } as any)
            expect(access).toEqual({ tenant: { in: ['tenant-1'] } })
        })

        it('TC-F08-G-03: Super Admin bypasses tenant isolation', () => {
            const req = { user: { roles: ['super-admin'], tenants: [] } } as any
            const access = Products.access!.read!({ req } as any)
            expect(access).toBe(true)
        })

        it('TC-F08-G-03: Users can only update products matching their tenant', async () => {
            // Mock multiple find() calls: plan-subscriptions and plan-features
            const req = {
                user: { tenants: [{ tenant: 'tenant-1' }, { tenant: 'tenant-2' }] },
                payload: {
                    find: vi.fn().mockImplementation(async (opts: any) => {
                        if (opts.collection === 'plan-subscriptions') {
                            return {
                                docs: [{
                                    id: 'sub-1',
                                    plan: 'PROFESSIONAL_TM_USER',
                                    status: 'active',
                                    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                                    canceledAt: null,
                                    canceledImmediately: false,
                                }],
                            }
                        }
                        if (opts.collection === 'plan-features') {
                            return {
                                docs: [{
                                    planCode: 'PROFESSIONAL_TM_USER',
                                    featureCode: 'product_management',
                                    value: 'UNLIMITED',
                                }],
                            }
                        }
                        return { docs: [] }
                    }),
                },
            } as any
            const access = await Products.access!.update!({ req } as any)
            expect(access).toEqual({ tenant: { in: ['tenant-1', 'tenant-2'] } })
        })

        it('TC-F08-G-03: Users without tenant mapping receive false for update', async () => {
            const req = { user: { tenants: [] } } as any
            const access = await Products.access!.update!({ req } as any)
            expect(access).toBe(false)
        })
    })
})

// GH-1587 Phase 01c: Tenant/site field spoof fix in Products (TC-F09-SEC-02)
describe('Products Collection Hooks — Tenant/Site Field Spoof (TC-F09-SEC-02)', () => {
    describe('beforeChangeHook — force tenant to actor\'s own', () => {
        const hook = Products.hooks!.beforeChange![0] as CollectionBeforeChangeHook

        it('TC-F09-SEC-02: Non-admin user spoofing tenant via {tenant:<victim>} PATCH gets forced back to own tenant on update', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn()
                }
            }
            const originalDoc = { id: 'prod-1', tenant: 'tenant-A', site: 'site-1', name: 'Product' }

            const result = await hook({
                data: { tenant: 'victim-tenant-B' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            // Tenant forced back to original tenant-A
            expect(result.tenant).toBe('tenant-A')
        })

        it('TC-F09-SEC-02: Multi-site validation — update with new site belonging to same tenant preserves it', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn().mockResolvedValueOnce({ docs: [{ id: 'site-3' }] })
                }
            }
            const originalDoc = { id: 'prod-1', tenant: 'tenant-A', site: 'site-2', name: 'Product' }

            const result = await hook({
                data: { name: 'Updated', site: 'site-3' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            expect(result.site).toBe('site-3')
            expect(req.payload.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: { equals: 'site-3' }, tenant: { equals: 'tenant-A' } }
                })
            )
        })

        it('TC-F09-SEC-02: Multi-site validation — update with site NOT belonging to tenant reverts to original', async () => {
            const req = {
                user: { id: 'user-1', tenants: [{ tenant: 'tenant-A' }] },
                payload: {
                    find: vi.fn().mockResolvedValueOnce({ docs: [] })
                }
            }
            const originalDoc = { id: 'prod-1', tenant: 'tenant-A', site: 'site-2', name: 'Product' }

            const result = await hook({
                data: { name: 'Updated', site: 'victim-site' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            // Rejected spoof, reverts to original
            expect(result.site).toBe('site-2')
        })

        it('TC-F09-SEC-02: Super-admin passthrough — no forcing of tenant', async () => {
            const req = {
                user: { id: 'admin', roles: ['super-admin'], tenants: [] },
                payload: {
                    find: vi.fn()
                }
            }
            const originalDoc = { id: 'prod-1', tenant: 'tenant-A', site: 'site-1', name: 'Product' }

            const result = await hook({
                data: { tenant: 'any-tenant', site: 'any-site' },
                originalDoc,
                operation: 'update',
                req
            } as any)

            // Super-admin gets their data unchanged
            expect(result.tenant).toBe('any-tenant')
            expect(result.site).toBe('any-site')
        })
    })
})
