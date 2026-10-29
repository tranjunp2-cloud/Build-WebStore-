/**
 * TC-AICP-211 — the write cores the dashboard pages and the copilot share:
 *   lib/customers/customer-service  (tenant check, rank check, only the given fields, order stats)
 *   lib/leads/lead-service          (status for every message of a person, site-ownership guard, restore)
 *   lib/email/template-settings-service (plan gate, security templates stay on, limits, upsert, reset)
 * and the server actions that call them keep their shapes (`updateShopCustomerAction`, `updateContactStatusAction`,
 * `saveEmailTemplateConfig`, `resetEmailTemplateConfig`). Faked: Payload (in memory), the plan lookup, the session.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Db, makeCms, newDb } from '../ai-platform/customers-fake-cms'

const h = vi.hoisted(() => ({ db: null as unknown as Db, cms: null as unknown, plan: { allowed: true } }))

vi.mock('payload', () => ({ getPayload: vi.fn(async () => h.cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({ getCurrentTenantId: vi.fn(async () => '1') }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'professional' })),
    canUse: vi.fn(async () => h.plan.allowed),
}))

import { resetEmailTemplateConfig, saveEmailTemplateConfig } from '@/app/(dashboard)/settings/email-templates/actions'
import { updateContactStatusAction } from '@/app/(dashboard)/contact-leads/actions'
import { updateShopCustomerAction } from '@/app/(dashboard)/customers/actions'
import { fetchCustomerOrderStats, rate, updateCustomerAs } from '@/lib/customers/customer-service'
import { resetEmailTemplateConfigAs, saveEmailTemplateConfigAs } from '@/lib/email/template-settings-service'
import { assertSiteOwnership, getLeadAs, leadStatusesUntouchedAs, restoreLeadStatusesAs, setLeadStatusAs } from '@/lib/leads/lead-service'
import { getCurrentTenantId } from '@/lib/auth'

const user = { id: 7, email: 'owner@kedai.my' } as never

beforeEach(() => {
    h.plan.allowed = true
    h.db = newDb()
    h.cms = makeCms(h.db)
    h.db.sites.push({ id: 5, tenant: 1, name: 'Kedai Batik' }, { id: 6, tenant: 2, name: 'Other' })
    h.db.customers.push({ id: 12, tenant: 1, name: 'Aisyah', rank: 'silver', notes: null, updatedAt: 'c12' }, { id: 99, tenant: { id: 2 }, name: 'Foreign', updatedAt: 'c99' })
    h.db['contact-submissions'].push(
        { id: 1, name: 'Ahmad', email: 'ahmad@x.my', message: 'a', site: 5, status: 'new', createdAt: '2026-10-10T00:00:00Z', updatedAt: 'l1' },
        { id: 2, name: 'Ahmad', email: 'ahmad@x.my', message: 'b', site: { id: 5 }, status: 'read', createdAt: '2026-10-11T00:00:00Z', updatedAt: 'l2' },
        { id: 3, name: 'Siti', email: 'siti@x.my', message: 'c', site: 5, status: 'new', createdAt: '2026-10-12T00:00:00Z', updatedAt: 'l3' },
        { id: 4, name: 'Intruder', email: 'i@x.my', message: 'd', site: 6, status: 'new', createdAt: '2026-10-13T00:00:00Z', updatedAt: 'l4' },
    )
})

describe('customer-service [TC-AICP-211]', () => {
    it('writes only the given fields of a customer of the workspace, as the named user', async () => {
        const saved = await updateCustomerAs({ tenantId: '1', user }, 12, { rank: 'vip', notes: 'VIP since raya' })

        expect(h.db.writes).toEqual([{ op: 'update', collection: 'customers', id: 12, data: { rank: 'vip', notes: 'VIP since raya' } }])
        expect(saved).toMatchObject({ id: 12, rank: 'vip', name: 'Aisyah' })
        expect((h.cms as { update: { mock: { calls: Array<[{ user: unknown }]> } } }).update.mock.calls[0]![0].user).toBe(user)
    })

    it('clears a rank with null, and refuses an unknown rank, before writing', async () => {
        await updateCustomerAs({ tenantId: '1' }, 12, { rank: null })
        expect(h.db.writes[0]!.data).toEqual({ rank: null })

        await expect(updateCustomerAs({ tenantId: '1' }, 12, { rank: 'platinum' as never })).rejects.toThrow('Invalid rank value')
        expect(h.db.writes).toHaveLength(1)
    })

    it('throws Unauthorized for a customer of another workspace (populated or plain tenant), without writing', async () => {
        await expect(updateCustomerAs({ tenantId: '1' }, 99, { name: 'x' })).rejects.toThrow('Unauthorized')
        await expect(updateShopCustomerAction(99, { name: 'x' })).rejects.toThrow('Unauthorized')
        expect(h.db.writes).toHaveLength(0)
    })

    it('the dashboard action goes through it and returns the mapped record', async () => {
        const out = await updateShopCustomerAction(12, { rank: 'gold' })

        expect(out).toMatchObject({ id: 12, rank: 'gold', name: 'Aisyah' })
        vi.mocked(getCurrentTenantId).mockResolvedValueOnce(null)
        await expect(updateShopCustomerAction(12, { rank: 'gold' })).rejects.toThrow('Unauthorized')
    })

    it('counts orders, spend, completed and cancelled per customer (and rounds the rates like the page)', async () => {
        h.db.orders.push(
            { id: 1, tenant: 1, customer: 12, total: 100, status: 'completed' },
            { id: 2, tenant: 1, customer: { id: 12 }, total: 50, status: 'cancelled' },
            { id: 3, tenant: 1, customer: 12, total: 25.5, status: 'completed' },
            { id: 4, tenant: 2, customer: 12, total: 999, status: 'completed' },
        )

        const stats = await fetchCustomerOrderStats(h.cms as never, [12], '1')

        expect(stats.get(12)).toEqual({ count: 3, total: 175.5, completed: 2, cancelled: 1 })
        expect(rate(2, 3)).toBe(66.67)
        expect(rate(0, 0)).toBe(0)
    })
})

describe('lead-service [TC-AICP-211]', () => {
    it('sets the status of every message of that person on that site and reports each one\'s earlier status', async () => {
        const { lead, written } = await setLeadStatusAs({ tenantId: '1' }, 1, 'replied')

        expect(lead).toMatchObject({ id: 1, status: 'replied' })
        expect(written.map((w) => [w.id, w.before]).sort((x, y) => Number(x[0]) - Number(y[0]))).toEqual([[1, 'new'], [2, 'read']])
        expect(h.db['contact-submissions'].map((d) => d.status)).toEqual(['replied', 'replied', 'new', 'new'])
    })

    it('never touches a lead whose site is not the workspace\'s', async () => {
        await expect(setLeadStatusAs({ tenantId: '1' }, 4, 'archived')).rejects.toThrow('Unauthorized')
        await expect(getLeadAs({ tenantId: '1' }, 4)).rejects.toThrow('Unauthorized')
        expect(h.db.writes).toHaveLength(0)
        expect(() => assertSiteOwnership(null, [5])).toThrow('Unauthorized')
        expect(() => assertSiteOwnership(6, [5])).toThrow('Unauthorized')
    })

    it('the dashboard action maps display words to the database ones and refuses an unknown status', async () => {
        const out = await updateContactStatusAction(3, 'ignored')

        expect(out).toMatchObject({ rawId: 3, status: 'ignored' })
        expect(h.db['contact-submissions'].find((d) => d.id === 3)!.status).toBe('archived')
        await expect(updateContactStatusAction(3, 'subscribed')).rejects.toThrow('Invalid status')
    })

    it('restores earlier statuses only while the messages are as our write left them', async () => {
        const { written } = await setLeadStatusAs({ tenantId: '1' }, 1, 'replied')
        const items = written.map((w) => ({ id: w.id, before: w.before, updatedAt: w.updatedAt }))

        expect(await leadStatusesUntouchedAs({ tenantId: '1' }, items)).toBe(true)
        h.db['contact-submissions'].find((d) => d.id === 2)!.updatedAt = 'opened'
        expect(await leadStatusesUntouchedAs({ tenantId: '1' }, items)).toBe(false)

        h.db['contact-submissions'].find((d) => d.id === 2)!.updatedAt = items.find((i) => i.id === 2)!.updatedAt
        await restoreLeadStatusesAs({ tenantId: '1' }, items)
        expect(h.db['contact-submissions'].map((d) => d.status)).toEqual(['new', 'read', 'new', 'new'])
        await expect(restoreLeadStatusesAs({ tenantId: '1' }, [{ id: 4, before: 'new', updatedAt: 'l4' }])).rejects.toThrow('Unauthorized')
    })
})

describe('template-settings-service [TC-AICP-211]', () => {
    const input = (over: Record<string, unknown> = {}) => ({ templateType: 'order-confirmation' as const, recipient: 'buyer' as const, enabled: true, contentEn: { greeting: 'Hello' }, ...over })

    it('creates the row the first time and updates it after, returning the row before and after', async () => {
        const first = await saveEmailTemplateConfigAs({ tenantId: '1' }, input())
        const second = await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ contentEn: { greeting: 'Hello again' }, contentMs: { greeting: 'Salam' } }))

        expect(first).toMatchObject({ success: true, before: null, after: { enabled: true, contentEn: { greeting: 'Hello' } } })
        expect(second.before).toMatchObject({ contentEn: { greeting: 'Hello' } })
        expect(second.after).toMatchObject({ contentEn: { greeting: 'Hello again' }, contentMs: { greeting: 'Salam' } })
        expect(h.db['email-template-settings']).toHaveLength(1)
        expect(h.db.writes.map((w) => w.op)).toEqual(['create', 'update'])
    })

    it('refuses without the plan feature, switching a security email off, and fields over their limit', async () => {
        h.plan.allowed = false
        expect(await saveEmailTemplateConfigAs({ tenantId: '1' }, input())).toEqual({ success: false, error: 'Email template configuration is not available on your current plan.' })
        h.plan.allowed = true
        expect(await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ templateType: 'otp-verification', enabled: false }))).toEqual({ success: false, error: 'Cannot disable critical template' })
        expect(await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ contentEn: { ctaLabel: 'x'.repeat(101) } }))).toEqual({ success: false, error: 'contentEn ctaLabel exceeds 100 characters' })
        expect(await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ contentMs: { subject: 'x'.repeat(201) } }))).toEqual({ success: false, error: 'contentMs subject exceeds 200 characters' })
        expect(h.db.writes).toHaveLength(0)
    })

    it('reset deletes the row (and returns it), or is a no-op on the built-in text', async () => {
        expect(await resetEmailTemplateConfigAs({ tenantId: '1' }, 'order-confirmation', 'buyer')).toEqual({ success: true, before: null, after: null })
        await saveEmailTemplateConfigAs({ tenantId: '1' }, input())

        const out = await resetEmailTemplateConfigAs({ tenantId: '1' }, 'order-confirmation', 'buyer')

        expect(out.before).toMatchObject({ enabled: true, contentEn: { greeting: 'Hello' } })
        expect(h.db['email-template-settings']).toHaveLength(0)
    })

    it('the dashboard actions keep their shapes: success, the refusal text, and "Internal server error" for a crash', async () => {
        expect(await saveEmailTemplateConfig(input())).toEqual({ success: true, updatedAt: 'u1' })
        h.plan.allowed = false
        expect(await saveEmailTemplateConfig(input())).toEqual({ success: false, error: 'Email template configuration is not available on your current plan.' })
        expect(await resetEmailTemplateConfig('order-confirmation', 'buyer')).toEqual({ success: true })
        expect(h.db['email-template-settings']).toHaveLength(0)

        vi.mocked(getCurrentTenantId).mockResolvedValueOnce(null)
        expect(await saveEmailTemplateConfig(input())).toEqual({ success: false, error: 'Unauthorized: No tenant found for current session.' })
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        h.plan.allowed = true
        h.db.failUpdate = () => new Error('db down')
        // the first save creates the row; the second one updates it, and the update crashes
        await saveEmailTemplateConfig(input())
        expect(await saveEmailTemplateConfig(input({ contentEn: { greeting: 'again' } }))).toEqual({ success: false, error: 'Internal server error' })
        log.mockRestore()
    })
})
