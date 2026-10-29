// @vitest-environment node
/**
 * TC-AICP-329 — customer edit with `expectedUpdatedAt`: the loaded version saves (the action returns the record with its
 * new updatedAt); a stale one answers the typed conflict and writes nothing; no version = as before; the tenant check stays first.
 * TC-AICP-330 — email template save: a row's version saves; a stale one is refused with the row's version now; a form that
 * started from the DEFAULT sends null = "no row", which is stale once a row exists (and fresh while there is none); a row that
 * was reset meanwhile gives current null; two first saves racing to create the row (unique index) give a conflict for the
 * loser; the action returns the new updatedAt, or the typed conflict; the copilot's applier call (no version) is unchanged.
 * Real: customer-service, template-settings-service, both server actions, save-version. Faked: Payload (in memory), plan gate, session.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Db, makeCms, newDb } from '../ai-platform/customers-fake-cms'

const h = vi.hoisted(() => ({ db: null as unknown as Db, cms: null as unknown }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => h.cms) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({ getCurrentTenantId: vi.fn(async () => '1') }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'professional' })),
    canUse: vi.fn(async () => true),
}))

import { saveEmailTemplateConfig } from '@/app/(dashboard)/settings/email-templates/actions'
import { updateShopCustomerAction } from '@/app/(dashboard)/customers/actions'
import { updateCustomerAs } from '@/lib/customers/customer-service'
import { saveEmailTemplateConfigAs } from '@/lib/email/template-settings-service'
import { VersionConflictError } from '@/lib/save-version/save-version'

const LOADED = '2026-10-22T01:00:00.000Z'
const NEWER = '2026-10-22T02:30:00.000Z'

beforeEach(() => {
    h.db = newDb()
    h.cms = makeCms(h.db)
    h.db.customers.push({ id: 12, tenant: 1, name: 'Aisyah', rank: 'silver', notes: null, updatedAt: LOADED })
})

describe('customer edit with expectedUpdatedAt [TC-AICP-329]', () => {
    it('TC-AICP-329: the loaded version saves; the action returns the record with the new updatedAt', async () => {
        const out = await updateShopCustomerAction(12, { notes: 'VIP' }, LOADED)

        expect(out).toMatchObject({ id: 12, notes: 'VIP' })
        expect(out.updatedAt).not.toBe(LOADED)
        expect(h.db.writes).toHaveLength(1)
        // the next save from the same page sends what it got
        expect(await updateShopCustomerAction(12, { notes: 'VIP 2' }, out.updatedAt)).toMatchObject({ notes: 'VIP 2' })
    })

    it('TC-AICP-329: a stale version is refused with the stored one; nothing is written; the action answers the typed result', async () => {
        h.db.customers[0]!.updatedAt = NEWER

        const err = await updateCustomerAs({ tenantId: '1' }, 12, { notes: 'mine' }, LOADED).catch((e) => e)
        expect(err).toBeInstanceOf(VersionConflictError)
        expect(err.current).toBe(NEWER)
        expect(await updateShopCustomerAction(12, { notes: 'mine' }, LOADED)).toEqual({ ok: false, code: 'VERSION_CONFLICT', current: NEWER })
        expect(h.db.writes).toHaveLength(0)
        expect(h.db.customers[0]!.notes).toBeNull()
    })

    it('TC-AICP-329: no version = as before; another workspace is Unauthorized, not a conflict', async () => {
        h.db.customers[0]!.updatedAt = NEWER
        await updateShopCustomerAction(12, { notes: 'late' })
        expect(h.db.writes).toHaveLength(1)

        h.db.customers.push({ id: 99, tenant: 2, name: 'Foreign', updatedAt: NEWER })
        await expect(updateShopCustomerAction(99, { notes: 'x' }, LOADED)).rejects.toThrow('Unauthorized')
    })
})

const input = (over: Record<string, unknown> = {}) => ({
    templateType: 'order-confirmation' as const,
    recipient: 'buyer' as const,
    enabled: true,
    contentEn: { greeting: 'Hello' },
    ...over,
})
const row = (over: Record<string, unknown> = {}) => ({ id: 31, tenant: 1, templateType: 'order-confirmation', recipient: 'buyer', enabled: true, contentEn: { greeting: 'Hi' }, contentMs: {}, updatedAt: LOADED, ...over })

describe('email template save with expectedUpdatedAt [TC-AICP-330]', () => {
    it('TC-AICP-330: a row\'s version updates it and returns the row\'s new updatedAt; the action passes it on', async () => {
        h.db['email-template-settings'].push(row())

        const out = await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ expectedUpdatedAt: LOADED }))

        expect(out).toMatchObject({ success: true, before: { updatedAt: LOADED } })
        expect(out.after!.updatedAt).not.toBe(LOADED)
        const viaAction = await saveEmailTemplateConfig(input({ contentEn: { greeting: 'Again' }, expectedUpdatedAt: out.after!.updatedAt }))
        expect(viaAction).toEqual({ success: true, updatedAt: expect.any(String) })
        expect(viaAction.updatedAt).not.toBe(out.after!.updatedAt)
    })

    it('TC-AICP-330: a stale row version is refused with the row\'s version now; nothing is written', async () => {
        h.db['email-template-settings'].push(row({ updatedAt: NEWER }))

        const out = await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ expectedUpdatedAt: LOADED }))

        expect(out).toEqual({ success: false, ok: false, code: 'VERSION_CONFLICT', current: NEWER })
        expect(h.db.writes).toHaveLength(0)
        expect(await saveEmailTemplateConfig(input({ expectedUpdatedAt: LOADED }))).toEqual({ success: false, ok: false, code: 'VERSION_CONFLICT', current: NEWER })
    })

    it('TC-AICP-330: started from the default (null): fresh while there is no row, a conflict once someone saved one', async () => {
        const first = await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ expectedUpdatedAt: null }))
        expect(first).toMatchObject({ success: true, before: null })
        expect(h.db['email-template-settings']).toHaveLength(1)

        h.db.writes.length = 0
        const late = await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ contentEn: { greeting: 'Mine' }, expectedUpdatedAt: null }))
        expect(late).toEqual({ success: false, ok: false, code: 'VERSION_CONFLICT', current: first.after!.updatedAt })
        expect(h.db.writes).toHaveLength(0)
        expect(h.db['email-template-settings'][0]!.contentEn).toEqual({ greeting: 'Hello' })
    })

    it('TC-AICP-330: a row reset meanwhile: its version is stale with current null; "Save mine anyway" (null) then creates it', async () => {
        const out = await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ expectedUpdatedAt: LOADED }))
        expect(out).toEqual({ success: false, ok: false, code: 'VERSION_CONFLICT', current: null })
        expect(h.db.writes).toHaveLength(0)

        const anyway = await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ expectedUpdatedAt: out.current }))
        expect(anyway).toMatchObject({ success: true })
        expect(h.db.writes.map((w) => w.op)).toEqual(['create'])
    })

    it('TC-AICP-330: two first saves meeting at the unique index: the loser gets the conflict, not an overwrite', async () => {
        // the row appears between the loser's read and its create, so the create hits the unique index
        const cms = h.cms as { create: (args: unknown) => Promise<unknown>; find: unknown }
        const realCreate = cms.create
        let first = true
        ;(h.cms as { create: unknown }).create = vi.fn(async (args: { collection: string }) => {
            if (first) {
                first = false
                h.db['email-template-settings'].push(row({ updatedAt: NEWER, contentEn: { greeting: 'Theirs' } }))
                throw new Error('duplicate key value violates unique constraint')
            }
            return realCreate(args)
        })

        const out = await saveEmailTemplateConfigAs({ tenantId: '1' }, input({ expectedUpdatedAt: null }))

        expect(out).toEqual({ success: false, ok: false, code: 'VERSION_CONFLICT', current: NEWER })
        expect(h.db['email-template-settings'][0]!.contentEn).toEqual({ greeting: 'Theirs' })
        expect(h.db.writes).toHaveLength(0)
    })

    it('TC-AICP-330: no version (the copilot applier) = the old upsert, over a newer row too', async () => {
        h.db['email-template-settings'].push(row({ updatedAt: NEWER }))
        const out = await saveEmailTemplateConfigAs({ tenantId: '1' }, input())
        expect(out).toMatchObject({ success: true })
        expect(h.db.writes.map((w) => w.op)).toEqual(['update'])
    })
})
