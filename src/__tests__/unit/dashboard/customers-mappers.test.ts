/**
 * Customer Record Mappers — TC-CUST-01 through TC-CUST-10
 * Tests mapContactSubmission + mapSubscriber pure functions.
 */
import { describe, it, expect } from 'vitest'
import {
    mapContactSubmission,
    mapSubscriber,
} from '@/app/(dashboard)/customers/_lib/customer-record'

describe('[TC-CUST-01..07] mapContactSubmission', () => {
    const base = {
        id: 42,
        name: 'Alice',
        email: 'alice@example.com',
        phone: '0123456789',
        message: 'Hello',
        status: 'new',
        site: null,
        createdAt: '2026-01-01T00:00:00.000Z',
    }

    it('[TC-CUST-01] maps DB status "new" → display "new"', () => {
        const result = mapContactSubmission({ ...base, status: 'new' })
        expect(result.status).toBe('new')
    })

    it('[TC-CUST-02] maps DB status "read" → display "read"', () => {
        const result = mapContactSubmission({ ...base, status: 'read' })
        expect(result.status).toBe('read')
    })

    it('[TC-CUST-03] maps DB status "replied" → display "contacted"', () => {
        const result = mapContactSubmission({ ...base, status: 'replied' })
        expect(result.status).toBe('contacted')
    })

    it('[TC-CUST-04] maps DB status "archived" → display "ignored"', () => {
        const result = mapContactSubmission({ ...base, status: 'archived' })
        expect(result.status).toBe('ignored')
    })

    it('[TC-CUST-05] produces composite id "contact-form:{rawId}"', () => {
        const result = mapContactSubmission(base)
        expect(result.id).toBe('contact-form:42')
        expect(result.rawId).toBe(42)
        expect(result.source).toBe('contact-form')
    })

    it('[TC-CUST-06] converts null/empty fields to null', () => {
        const result = mapContactSubmission({ ...base, name: '', phone: '', message: '' })
        expect(result.name).toBeNull()
        expect(result.phone).toBeNull()
        expect(result.message).toBeNull()
    })

    it('[TC-CUST-07] resolves siteId from relationship object', () => {
        const resultObj = mapContactSubmission({ ...base, site: { id: 7 } })
        expect(resultObj.siteId).toBe(7)
        const resultNum = mapContactSubmission({ ...base, site: 3 })
        expect(resultNum.siteId).toBe(3)
        const resultNull = mapContactSubmission({ ...base, site: null })
        expect(resultNull.siteId).toBeNull()
    })
})

describe('[TC-CUST-08..10] mapSubscriber', () => {
    const base = {
        id: 99,
        email: 'bob@example.com',
        site: null,
        createdAt: '2026-02-01T00:00:00.000Z',
    }

    it('[TC-CUST-08] always returns status "subscribed"', () => {
        const result = mapSubscriber(base)
        expect(result.status).toBe('subscribed')
    })

    it('[TC-CUST-09] produces composite id "newsletter:{rawId}"', () => {
        const result = mapSubscriber(base)
        expect(result.id).toBe('newsletter:99')
        expect(result.rawId).toBe(99)
        expect(result.source).toBe('newsletter')
    })

    it('[TC-CUST-10] name/phone/message are always null', () => {
        const result = mapSubscriber(base)
        expect(result.name).toBeNull()
        expect(result.phone).toBeNull()
        expect(result.message).toBeNull()
    })
})
