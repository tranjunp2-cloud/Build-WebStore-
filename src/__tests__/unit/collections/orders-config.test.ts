import { describe, it, expect } from 'vitest'
import { Orders } from '@/collections/Orders'

// ─── TC-F10: Order collection structure ───────────────────────────────

describe('Orders collection config [TC-F10]', () => {
    it('has slug "orders"', () => {
        expect(Orders.slug).toBe('orders')
    })

    it('uses "orderNumber" as admin title', () => {
        expect(Orders.admin?.useAsTitle).toBe('orderNumber')
    })

    it('has required fields: tenant, site, orderNumber, items, status', () => {
        const fieldNames = Orders.fields
            .filter((f: any) => f.name)
            .map((f: any) => f.name)

        expect(fieldNames).toContain('tenant')
        expect(fieldNames).toContain('site')
        expect(fieldNames).toContain('orderNumber')
        expect(fieldNames).toContain('items')
        expect(fieldNames).toContain('status')
    })

    it('has financial fields: subtotal, shippingFee, tax, total', () => {
        const fieldNames = Orders.fields
            .filter((f: any) => f.name)
            .map((f: any) => f.name)

        expect(fieldNames).toContain('subtotal')
        expect(fieldNames).toContain('shippingFee')
        expect(fieldNames).toContain('tax')
        expect(fieldNames).toContain('total')
    })

    it('has customer fields: customerEmail, customerName, customerPhone', () => {
        const fieldNames = Orders.fields
            .filter((f: any) => f.name)
            .map((f: any) => f.name)

        expect(fieldNames).toContain('customerEmail')
        expect(fieldNames).toContain('customerName')
        expect(fieldNames).toContain('customerPhone')
    })

    it('delete access always returns false (orders cannot be deleted)', () => {
        const deleteAccess = Orders.access?.delete
        expect(typeof deleteAccess).toBe('function')
        const result = (deleteAccess as Function)({} as any)
        expect(result).toBe(false)
    })

    it('create access requires authentication', () => {
        const createAccess = Orders.access?.create
        expect(typeof createAccess).toBe('function')

        // No user → false
        const noUser = (createAccess as Function)({ req: {} } as any)
        expect(noUser).toBeFalsy()

        // With user → true
        const withUser = (createAccess as Function)({ req: { user: { id: 1 } } } as any)
        expect(withUser).toBeTruthy()
    })
})
