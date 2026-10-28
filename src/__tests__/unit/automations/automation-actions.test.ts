/**
 * TC-AICP-235 — settings server actions: signed-out → unauthorized, anyone but an active owner / admin of the
 * workspace (custom staff with the Settings permission, viewers, another workspace's owner, a pending owner, a
 * platform super-admin) → forbidden BEFORE any read or write; bad input → invalid; the owner saves exactly the
 * validated switches for THEIR workspace.
 * TC-AICP-237 — "Run now" has the same gate plus a rate limit, uses the saved settings and the member's language, and
 * returns the preview without storing anything.
 * Real: actions, access rule, input schema. Faked: auth session, Payload, the store, the preview, the limiter.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
    getCurrentTenantId: vi.fn(),
    getPayload: vi.fn(),
    save: vi.fn(),
    read: vi.fn(),
    preview: vi.fn(),
    limit: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser, getCurrentTenantId: mocks.getCurrentTenantId }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/automations/automation-store', () => ({ saveAutomationSettings: mocks.save, readAutomationSettings: mocks.read }))
vi.mock('@/lib/automations/automation-runner', () => ({ previewAutomations: mocks.preview }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: mocks.limit }))

import { previewAutomationsAction, saveAutomationSettingsAction } from '@/app/(dashboard)/settings/email-templates/automation-actions'
import { canManageAutomations } from '@/lib/automations/automation-access'
import { defaultAutomationSettings } from '@/lib/automations/automation-config'

const INPUT = { enabled: { discounts: true, stock: false, orders_waiting: true, leads: true, site_health: true }, digest: { enabled: true, frequency: 'daily' } }
const member = (role: string, over: Record<string, unknown> = {}) => ({ id: 1, roles: [], prefer_lang: 'en', tenants: [{ tenant: 4, role, status: 'active', ...over }] })

beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPayload.mockResolvedValue({ marker: 'payload' })
    mocks.getCurrentTenantId.mockResolvedValue('4')
    mocks.getCurrentUser.mockResolvedValue(member('owner'))
    mocks.save.mockResolvedValue(defaultAutomationSettings())
    mocks.read.mockResolvedValue(defaultAutomationSettings())
    mocks.preview.mockResolvedValue({ day: '2026-10-27', reminders: [], mondayOnly: [], off: [], digest: { enabled: false, frequency: 'daily' } })
    mocks.limit.mockResolvedValue({ allowed: true, remaining: 19, resetAt: 0 })
})

describe('canManageAutomations [TC-AICP-235]', () => {
    it.each([
        ['owner', member('owner'), true],
        ['admin', member('admin'), true],
        ['editor', member('editor'), false],
        ['viewer', member('viewer'), false],
        ['custom staff with settings', member('custom', { permissions: ['settings'] }), false],
        ['pending owner', member('owner', { status: 'pending' }), false],
        ['another workspace owner', member('owner', { tenant: 9 }), false],
        ['super-admin without membership', { roles: ['super-admin'], tenants: [] }, false],
        ['nobody', null, false],
    ])('%s -> %s', (_label, user, expected) => {
        expect(canManageAutomations(user, 4)).toBe(expected)
    })

    it('accepts a populated tenant reference', () => {
        expect(canManageAutomations({ tenants: [{ tenant: { id: 4 }, role: 'admin', status: 'active' }] }, '4')).toBe(true)
    })
})

describe('saveAutomationSettingsAction [TC-AICP-235]', () => {
    it('saves the validated switches for the signed-in owner\'s own workspace', async () => {
        const result = await saveAutomationSettingsAction(INPUT)

        expect(result).toEqual({ success: true, data: defaultAutomationSettings() })
        expect(mocks.save).toHaveBeenCalledWith({ marker: 'payload' }, '4', INPUT)
    })

    it('answers unauthorized when signed out or without a workspace', async () => {
        mocks.getCurrentUser.mockResolvedValue(null)
        expect(await saveAutomationSettingsAction(INPUT)).toEqual({ success: false, error: 'unauthorized' })

        mocks.getCurrentUser.mockResolvedValue(member('owner'))
        mocks.getCurrentTenantId.mockResolvedValue(null)
        expect(await saveAutomationSettingsAction(INPUT)).toEqual({ success: false, error: 'unauthorized' })
        expect(mocks.save).not.toHaveBeenCalled()
    })

    it.each([
        ['an editor', member('editor')],
        ['custom staff with the Settings permission', member('custom', { permissions: ['settings'] })],
        ['an owner of another workspace', member('owner', { tenant: 9 })],
        ['a super-admin', { roles: ['super-admin'], tenants: [] }],
    ])('refuses %s before touching anything', async (_label, user) => {
        mocks.getCurrentUser.mockResolvedValue(user)

        expect(await saveAutomationSettingsAction(INPUT)).toEqual({ success: false, error: 'forbidden' })
        expect(mocks.getPayload).not.toHaveBeenCalled()
        expect(mocks.save).not.toHaveBeenCalled()
    })

    it.each([
        ['nothing', undefined],
        ['a missing switch', { ...INPUT, enabled: { discounts: true } }],
        ['the cron markers', { ...INPUT, lastRunDay: '2026-10-27' }],
        ['a tenant override', { ...INPUT, tenantId: 9 }],
        ['a bad frequency', { ...INPUT, digest: { enabled: true, frequency: 'hourly' } }],
    ])('refuses %s as invalid', async (_label, raw) => {
        expect(await saveAutomationSettingsAction(raw)).toEqual({ success: false, error: 'invalid' })
        expect(mocks.save).not.toHaveBeenCalled()
    })

    it('answers failed (and logs) when storage breaks', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.save.mockRejectedValue(new Error('db down'))

        expect(await saveAutomationSettingsAction(INPUT)).toEqual({ success: false, error: 'failed' })
        log.mockRestore()
    })
})

describe('previewAutomationsAction [TC-AICP-237]', () => {
    it('previews the saved settings in the member\'s language and stores nothing', async () => {
        mocks.getCurrentUser.mockResolvedValue({ ...member('admin'), prefer_lang: 'ms' })

        const result = await previewAutomationsAction()

        expect(result.success).toBe(true)
        expect(mocks.preview).toHaveBeenCalledWith({ marker: 'payload' }, expect.objectContaining({ tenantId: '4', locale: 'ms', settings: defaultAutomationSettings(), now: expect.any(Date) }))
        expect(mocks.limit).toHaveBeenCalledWith('automations:preview:4', 20, 3_600_000)
        expect(mocks.save).not.toHaveBeenCalled()
    })

    it('has the same gate: signed out, staff and other workspaces get nothing', async () => {
        mocks.getCurrentUser.mockResolvedValue(null)
        expect(await previewAutomationsAction()).toEqual({ success: false, error: 'unauthorized' })

        mocks.getCurrentUser.mockResolvedValue(member('custom', { permissions: ['settings', 'orders'] }))
        expect(await previewAutomationsAction()).toEqual({ success: false, error: 'forbidden' })
        expect(mocks.preview).not.toHaveBeenCalled()
    })

    it('is rate limited per workspace', async () => {
        mocks.limit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 })

        expect(await previewAutomationsAction()).toEqual({ success: false, error: 'rate_limited' })
        expect(mocks.preview).not.toHaveBeenCalled()
    })

    it('answers failed (and logs) when the preview breaks', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.preview.mockRejectedValue(new Error('boom'))

        expect(await previewAutomationsAction()).toEqual({ success: false, error: 'failed' })
        log.mockRestore()
    })
})
