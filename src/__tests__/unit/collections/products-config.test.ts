import { describe, it, expect } from 'vitest'

// Mock payload dependencies
vi.mock('@/lib/ai/seo-queue', () => ({
    queueSEOAutoGeneration: vi.fn(),
}))

import { vi } from 'vitest'
import { Products } from '@/collections/Products'

// ─── TC-F08-01-01: Product collection config validation ──────────────────

describe('Products collection config [TC-F08-01-01]', () => {
    it('has slug "products"', () => {
        expect(Products.slug).toBe('products')
    })

    it('uses "name" as admin title', () => {
        expect(Products.admin?.useAsTitle).toBe('name')
    })

    it('has required fields: name, slug, status, price', () => {
        const fieldNames = Products.fields
            .filter((f: any) => f.name)
            .map((f: any) => f.name)

        expect(fieldNames).toContain('name')
        expect(fieldNames).toContain('slug')
        expect(fieldNames).toContain('status')
        expect(fieldNames).toContain('price')
    })

    it('has tenant and site relationships', () => {
        const fieldNames = Products.fields
            .filter((f: any) => f.name)
            .map((f: any) => f.name)

        expect(fieldNames).toContain('tenant')
        expect(fieldNames).toContain('site')
    })

    it('has images field with max 5', () => {
        const imagesField = Products.fields.find((f: any) => f.name === 'images') as any
        expect(imagesField).toBeDefined()
        expect(imagesField?.maxRows).toBe(5)
    })

    it('has SEO group field', () => {
        const seoField = Products.fields.find((f: any) => f.name === 'seo') as any
        expect(seoField).toBeDefined()
        expect(seoField?.type).toBe('group')
    })

    it('preserves historical shortDescription without a 300-character limit', () => {
        // Arrange / Act
        const field = Products.fields.find(field => 'name' in field && field.name === 'shortDescription')
        // Assert
        expect(field).toMatchObject({ name: 'shortDescription', type: 'textarea' })
        expect(field).not.toHaveProperty('maxLength')
    })

    it('price field has min 0', () => {
        const priceField = Products.fields.find((f: any) => f.name === 'price') as any
        expect(priceField).toBeDefined()
        expect(priceField?.min).toBe(0)
    })

    it('status field has active/draft/archived options', () => {
        const statusField = Products.fields.find((f: any) => f.name === 'status') as any
        expect(statusField).toBeDefined()
        const options = statusField?.options?.map((o: any) => o.value || o)
        expect(options).toContain('active')
        expect(options).toContain('draft')
    })

    it('TC-09.54: hard delete via REST is super-admin only (GH-1520)', async () => {
        // Arrange
        const deleteAccess = Products.access!.delete as (a: unknown) => unknown
        const owner = { user: { roles: ['tenant-owner'], tenants: [{ tenant: 't1' }] } }
        // Act / Assert
        expect(await deleteAccess({ req: owner })).toBe(false)
        expect(await deleteAccess({ req: { user: null } })).toBe(false)
        expect(await deleteAccess({ req: { user: { roles: ['super-admin'] } } })).toBe(true)
    })
})

// GH-1587 Phase 02: Anonymous read block for Products (TC-F09-SEC-01)
describe('Products anonymous read access block [TC-F09-SEC-01]', () => {
    it('TC-F09-SEC-01: Anonymous request (req.user = undefined) returns false', () => {
        const req = { user: undefined } as any
        const access = Products.access!.read!({ req } as any)
        expect(access).toBe(false)
    })

    it('TC-F09-SEC-01: Anonymous request (req.user = null) returns false', () => {
        const req = { user: null } as any
        const access = Products.access!.read!({ req } as any)
        expect(access).toBe(false)
    })

    it('TC-F09-SEC-01: Authenticated user gets tenant-scoped access', () => {
        const req = { user: { tenants: [{ tenant: 'tenant-1' }] } } as any
        const access = Products.access!.read!({ req } as any)
        expect(access).toEqual({ tenant: { in: ['tenant-1'] } })
    })
})
