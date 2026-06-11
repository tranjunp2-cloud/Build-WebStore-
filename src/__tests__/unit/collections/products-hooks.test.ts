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
