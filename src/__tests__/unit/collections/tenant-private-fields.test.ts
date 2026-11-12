/**
 * TC-PERF-151 — Tenant fields only some members may read: the raw SSO `metaData` (owner name / email / phone) is
 * super-admin only; the payout bank account (bank, holder, full number) is for the shop's active owners / admins.
 * Buyers see `•••• 1234` before ordering.
 * Real: collections/Tenants.ts field access, lib/payment/payout-account-access.ts.
 */
import { describe, expect, it } from 'vitest'

import { Tenants } from '@/collections/Tenants'
import { canReadPayoutAccount, maskAccountNumber, withoutPayoutAccount } from '@/lib/payment/payout-account-access'

type AnyField = { name?: string; fields?: AnyField[]; access?: { read?: (args: unknown) => unknown } }
const field = (path: string[]): AnyField => {
    let fields = Tenants.fields as AnyField[]
    let found: AnyField | undefined
    for (const name of path) {
        found = fields.find((f) => f.name === name)
        fields = found?.fields ?? []
    }
    if (!found) throw new Error(`no field ${path.join('.')}`)
    return found
}
const member = (role: string, status = 'active', tenant: unknown = 5) => ({ id: 1, roles: ['tenant-owner'], tenants: [{ tenant, role, status }] })
const superAdmin = { id: 9, roles: ['super-admin'], tenants: [] }
const readAs = (f: AnyField, user: unknown, doc = { id: 5 }) => f.access!.read!({ req: { user }, doc, id: doc.id })

describe('tenant private fields [TC-PERF-151]', () => {
    it('metaData: super-admin only', () => {
        const metaData = field(['metaData'])

        expect(readAs(metaData, superAdmin)).toBe(true)
        expect(readAs(metaData, member('owner'))).toBe(false)
        expect(readAs(metaData, member('viewer'))).toBe(false)
        expect(readAs(metaData, null)).toBe(false)
    })

    it.each(['bank_name', 'account_holder_name', 'account_number'])('payments.%s: owners / admins of that shop', (name) => {
        const f = field(['payments', name])

        expect(readAs(f, member('owner'))).toBe(true)
        expect(readAs(f, member('admin', 'active', { id: 5 }))).toBe(true)
        expect(readAs(f, superAdmin)).toBe(true)
        expect(readAs(f, member('viewer'))).toBe(false)
        expect(readAs(f, member('editor'))).toBe(false)
        expect(readAs(f, member('owner', 'pending'))).toBe(false)
        expect(readAs(f, member('owner', 'active', 6))).toBe(false)
        expect(readAs(f, null)).toBe(false)
    })

    it('drops only the payout account from the payments group', () => {
        const payments = { payment_cod: true, qr_image: 3, bank_name: 'Maybank', account_holder_name: 'K', account_number: '123' }

        expect(withoutPayoutAccount(payments)).toEqual({ payment_cod: true, qr_image: 3 })
        expect(canReadPayoutAccount(member('viewer'), 5)).toBe(false)
    })

    it('masks the account number to the last 4 digits', () => {
        expect(maskAccountNumber('5140 1234 5678')).toBe('•••• 5678')
        expect(maskAccountNumber('')).toBeNull()
        expect(maskAccountNumber(null)).toBeNull()
    })
})
