/**
 * TC-AICP-145..149 — the shop's discount codes through the copilot (store.discounts / store.prepare_discounts,
 * `store.discounts_patch`, undo `store.discounts_restore`):
 *   145  the read: counts and the list with live state (active / inactive / scheduled / expired / used up),
 *        filters (ending within 14 days, never used), one code in full with why it can't be switched on
 *   146  the new-code card: percent / RM → stored value, KL calendar days, a code unique per store (any case),
 *        the form's own validation, sites of the store only
 *   147  the change card: before → after rows, the form's activation guard (ended / at its limit) — also
 *        satisfied inside the same card — pause, delete asks for the code, nothing to change is refused
 *   148  the apply: the Discounts write core as the approver in the drafted workspace, 409 when edited since,
 *        the guard once more at apply time, a half-run change put back
 *   149  undo: reverse order, refused once edited since or when a deleted code is taken again
 * Real: store-discounts.ts, store-discounts-prepare.ts, appliers/store-discounts.ts, the activation guard and
 * date helpers. Faked: Payload (in memory), the Discounts write core (discount-service: tested in TC-AICP-150),
 * the user's tenant.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { endOfDayKL, startOfDayKL } from '@/lib/discounts/date-boundaries'

type Doc = { id: number; code: string; description?: string; type: 'percentage' | 'fixed'; value: number; status: 'active' | 'inactive'; usageLimit?: number | null; usageCount: number; startsAt?: string | null; expiresAt?: string | null; site?: number | null; updatedAt: string }

const state = vi.hoisted(() => ({
    discounts: [] as Array<Record<string, unknown>>,
    calls: [] as Array<{ fn: string; args: unknown[] }>,
    failOn: null as { fn: string; error: unknown } | null,
    nextId: 100,
    /** discount_usage_history rows per discount id */
    history: {} as Record<number, number>,
}))

vi.mock('payload', () => {
    const cms = {
        find: vi.fn(async ({ collection }: { collection: string }) => {
            if (collection === 'sites') return { docs: [{ id: 7, name: 'Kedai Batik' }, { id: 8, name: 'Kedai Kopi' }], totalDocs: 2 }
            return { docs: state.discounts.map((d) => ({ ...d })), totalDocs: state.discounts.length }
        }),
        count: vi.fn(async ({ where }: { where: { discount: { equals: number } } }) => ({ totalDocs: state.history[Number(where.discount.equals)] ?? 0 })),
    }
    return { getPayload: vi.fn(async () => cms) }
})
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({ tenantIdForQuery: vi.fn(() => 1) }))
vi.mock('@/lib/discounts/discount-service', () => {
    class DiscountServiceError extends Error {
        constructor(readonly code: string, message: string) {
            super(message)
        }
    }
    const record = (fn: string, args: unknown[]) => {
        state.calls.push({ fn, args })
        if (state.failOn?.fn === fn) throw state.failOn.error
    }
    return {
        DiscountServiceError,
        createDiscountAs: vi.fn(async (actor: unknown, data: Record<string, unknown>) => {
            record('create', [actor, data])
            const doc = { id: state.nextId++, ...data, usageCount: data.usageCount ?? 0, updatedAt: `new-${state.nextId}` }
            state.discounts.push(doc)
            return doc
        }),
        updateDiscountAs: vi.fn(async (actor: unknown, id: number, data: Record<string, unknown>) => {
            record('update', [actor, id, data])
            const doc = state.discounts.find((d) => d.id === id)!
            Object.assign(doc, data, { updatedAt: `edit-${state.calls.length}` })
            return doc
        }),
        deleteDiscountAs: vi.fn(async (actor: unknown, id: number) => {
            record('delete', [actor, id])
            state.discounts = state.discounts.filter((d) => d.id !== id)
        }),
    }
})

import { applyStoreDiscountsPatch, applyStoreDiscountsRestore } from '@/lib/ai-platform/appliers/store-discounts'
import { readStoreDiscounts } from '@/lib/ai-platform/store/store-discounts'
import { prepareStoreDiscounts } from '@/lib/ai-platform/store/store-discounts-prepare'
import { createDiscountAs, DiscountServiceError, deleteDiscountAs, updateDiscountAs } from '@/lib/discounts/discount-service'

// 2026-10-22 12:00 in Kuala Lumpur
const NOW = new Date('2026-10-22T04:00:00Z')
const member = { tenant: 1, role: 'owner', status: 'active' }
const actor = { user: { id: 3, tenants: [member] }, tenantId: '1', organizationId: 'org_1' } as never
const ends = (day: string) => endOfDayKL(day).toISOString()
const starts = (day: string) => startOfDayKL(day).toISOString()

type Prepared = { error?: { code: string; message: string }; kind?: string; title?: string; risk?: string; confirmText?: string; diffs?: Array<{ entity: { kind: string; id: string; label?: string }; field: string; before: string | null; after: string }>; guardrails?: Array<{ rule: string; detail: string }>; plan?: Record<string, unknown> }
const draft = (changes: unknown[]) => prepareStoreDiscounts(actor, { why: 'raya campaign', changes }, NOW) as Promise<Prepared>
const updateStep = (over: Record<string, unknown>) => ({ op: 'update', discountId: '1', code: null, type: null, amount: null, description: null, usageLimit: null, removeLimit: false, startsOn: null, removeStart: false, endsOn: null, removeEnd: false, siteId: null, allSites: false, ...over })
// ICU prints September as "Sept" in some builds: the test reads it as "Sep"
const sep = (text: string) => text.replace(/Sept\b/g, 'Sep')
const rows = (prepared: Prepared) => (prepared.diffs ?? []).map((d) => sep(`${d.entity.label} | ${d.field} | ${d.before ? `${d.before} ` : ''}-> ${d.after}`))

beforeEach(() => {
    vi.clearAllMocks()
    state.history = {}
    const docs: Doc[] = [
        { id: 1, code: 'SUMMER10', type: 'percentage', value: 10, status: 'active', usageLimit: 100, usageCount: 23, expiresAt: ends('2026-12-31'), updatedAt: 'u1' },
        { id: 2, code: 'RAYA5', type: 'fixed', value: 500, status: 'active', usageLimit: null, usageCount: 0, updatedAt: 'u2', description: 'Raya gift' },
        { id: 3, code: 'OLD20', type: 'percentage', value: 20, status: 'inactive', usageLimit: null, usageCount: 5, expiresAt: ends('2026-09-30'), updatedAt: 'u3' },
        { id: 4, code: 'SOLD', type: 'percentage', value: 15, status: 'active', usageLimit: 10, usageCount: 10, updatedAt: 'u4' },
        { id: 5, code: 'NEWYEAR', type: 'percentage', value: 12, status: 'active', usageLimit: null, usageCount: 0, startsAt: starts('2027-01-01'), expiresAt: ends('2027-01-07'), updatedAt: 'u5' },
        { id: 6, code: 'SOON', type: 'percentage', value: 5, status: 'active', usageLimit: null, usageCount: 0, expiresAt: ends('2026-10-30'), site: 7, updatedAt: 'u6' },
    ]
    state.discounts = docs.map((d) => ({ ...d }))
    state.calls = []
    state.failOn = null
    state.nextId = 100
})

describe('store discounts read [TC-AICP-145]', () => {
    it('counts the codes by what shoppers get right now and lists them with a one-line summary', async () => {
        const read = (await readStoreDiscounts(actor, {}, NOW)) as Record<string, any>

        expect(read.counts).toEqual({ total: 6, active: 3, inactive: 1, scheduled: 1, expired: 0, usedUp: 1, expiringIn14Days: 1, unused: 3 })
        expect(read.shop).toEqual({ currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', today: '2026-10-22' })
        expect(read.discounts).toContainEqual({ id: '1', code: 'SUMMER10', summary: '10% off · until 31 Dec 2026 · 23/100 used', status: 'active', effectiveStatus: 'active', appliesTo: 'all sites' })
        expect(read.discounts).toContainEqual(expect.objectContaining({ code: 'RAYA5', summary: 'RM 5.00 off · no end date · 0 used' }))
        expect(read.discounts).toContainEqual(expect.objectContaining({ code: 'SOLD', summary: '15% off · no end date · 10/10 used · used up', effectiveStatus: 'used-up' }))
        expect(read.discounts).toContainEqual(expect.objectContaining({ code: 'SOON', appliesTo: 'Kedai Batik' }))
        expect(read.sites).toEqual([{ id: '7', name: 'Kedai Batik' }, { id: '8', name: 'Kedai Kopi' }])
    })

    it('filters: ending within 14 days, never used, scheduled, and words of a code or description', async () => {
        const codes = async (input: Record<string, unknown>) => ((await readStoreDiscounts(actor, input, NOW)) as { discounts: Array<{ code: string }> }).discounts.map((d) => d.code)

        expect(await codes({ filter: 'expiring_soon' })).toEqual(['SOON'])
        expect(await codes({ filter: 'unused' })).toEqual(['RAYA5', 'NEWYEAR', 'SOON'])
        expect(await codes({ filter: 'scheduled' })).toEqual(['NEWYEAR'])
        expect(await codes({ query: 'raya' })).toEqual(['RAYA5'])
        expect(await codes({ filter: 'inactive', limit: 1 })).toEqual(['OLD20'])
    })

    it('reads one code in full by id or code, with the date in the shop\'s day and why it cannot be switched on', async () => {
        const byId = (await readStoreDiscounts(actor, { id: '3' }, NOW)) as { discount: Record<string, unknown> }
        const byCode = (await readStoreDiscounts(actor, { code: 'summer10' }, NOW)) as { discount: Record<string, unknown> }

        expect(byId.discount).toMatchObject({ code: 'OLD20', percent: 20, status: 'inactive', effectiveStatus: 'inactive', endsOn: '2026-09-30', used: 5, usesLeft: null })
        expect(sep(String(byId.discount.cannotBeSwitchedOnBecause))).toContain('ended on 30 Sep 2026')
        expect(byCode.discount).toMatchObject({ id: '1', usageLimit: 100, usesLeft: 77, endsOn: '2026-12-31' })
        expect(byCode.discount).not.toHaveProperty('cannotBeSwitchedOnBecause')
        expect(await readStoreDiscounts(actor, { id: '999' }, NOW)).toMatchObject({ error: { code: 'unknown_discount' } })
    })
})

describe('the new-code card [TC-AICP-146]', () => {
    const create = { op: 'create', code: 'raya10', type: 'percentage', amount: 10, description: null, usageLimit: 50, startsOn: null, endsOn: '2026-11-30', siteId: null, status: null }

    it('makes a code in capitals with the shop\'s calendar days, readable for the merchant', async () => {
        const prepared = await draft([create])

        expect(prepared.kind).toBe('store.discounts_patch')
        expect(prepared.title).toBe('New discount: RAYA10')
        expect(prepared.risk).toBe('medium')
        expect(rows(prepared)).toEqual(['RAYA10 | New discount | -> 10% off · until 30 Nov 2026 · 0/50 used'])
        expect(prepared.guardrails?.map((g) => g.rule)).toEqual(['same_rules', 'undo', 'live'])
        expect(prepared.plan).toEqual({
            steps: [{ op: 'create', data: { code: 'RAYA10', description: null, type: 'percentage', value: 10, status: 'active', usageLimit: 50, startsAt: null, expiresAt: '2026-11-30', site: null } }],
            base: {},
        })
    })

    it('stores a fixed amount in sen, and a paused new code starts inactive without a live note', async () => {
        const prepared = await draft([{ ...create, code: 'GIFT', type: 'fixed', amount: 7.5, usageLimit: null, endsOn: null, status: 'paused', siteId: '8', description: 'Free gift' }])

        expect(prepared.plan).toMatchObject({ steps: [{ data: { value: 750, status: 'inactive', site: 8, description: 'Free gift' } }] })
        expect(prepared.risk).toBe('low')
        expect(rows(prepared)).toEqual(['GIFT | New discount | -> RM 7.50 off · no end date · 0 used · inactive', 'GIFT | Applies to | -> Kedai Kopi', 'GIFT | Description | -> Free gift'])
        expect(prepared.guardrails?.map((g) => g.rule)).not.toContain('live')
    })

    it('never reuses a code that exists, in any case, nor one made earlier in the same card', async () => {
        expect((await draft([{ ...create, code: 'summer10' }])).error).toMatchObject({ code: 'code_taken', message: expect.stringContaining('id 1: 10% off · until 31 Dec 2026 · 23/100 used') })
        expect((await draft([create, { ...create, code: 'RAYA10' }])).error).toMatchObject({ code: 'code_taken' })
    })

    it('applies the form\'s own validation', async () => {
        expect((await draft([{ ...create, amount: 150 }])).error).toMatchObject({ code: 'invalid_amount' })
        expect((await draft([{ ...create, amount: 10.5 }])).error).toMatchObject({ code: 'invalid_amount' })
        expect((await draft([{ ...create, type: 'fixed', amount: 2_000_000 }])).error).toMatchObject({ code: 'invalid_amount' })
        expect((await draft([{ ...create, type: 'fixed', amount: 1.005 }])).error).toMatchObject({ code: 'invalid_amount', message: expect.stringContaining('2 decimals') })
        expect((await draft([{ ...create, code: 'no spaces' }])).error).toMatchObject({ code: 'invalid_input', message: expect.stringContaining('letters, numbers') })
        expect((await draft([{ ...create, startsOn: '2026-12-01', endsOn: '2026-11-30' }])).error).toMatchObject({ code: 'invalid_input', message: expect.stringContaining('end date must be after') })
        expect((await draft([{ ...create, siteId: '99' }])).error).toMatchObject({ code: 'unknown_site' })
    })

    it('does not switch on a new code whose end date has passed', async () => {
        expect((await draft([{ ...create, endsOn: '2026-10-01' }])).error).toMatchObject({ code: 'expired_cannot_activate' })
        // paused it is only a draft of a code: fine
        expect((await draft([{ ...create, endsOn: '2026-10-01', status: 'paused' }])).error).toBeUndefined()
    })
})

describe('the change card [TC-AICP-147]', () => {
    const update = { op: 'update', discountId: '1', code: null, type: null, amount: null, description: null, usageLimit: null, removeLimit: false, startsOn: null, removeStart: false, endsOn: null, removeEnd: false, siteId: null, allSites: false }

    it('shows each changed value before → after under the code and how it stands today', async () => {
        const prepared = await draft([{ ...update, amount: 15, endsOn: '2027-01-15', usageLimit: 200, description: 'Mid year sale' }])

        expect(prepared.title).toBe('Change discount: SUMMER10')
        expect(rows(prepared)).toEqual([
            'SUMMER10 · 10% off · until 31 Dec 2026 · 23/100 used | Discount | 10% off -> 15% off',
            'SUMMER10 · 10% off · until 31 Dec 2026 · 23/100 used | Description | -> Mid year sale',
            'SUMMER10 · 10% off · until 31 Dec 2026 · 23/100 used | Usage limit | Up to 100 uses (23 used so far) -> Up to 200 uses (23 used so far)',
            'SUMMER10 · 10% off · until 31 Dec 2026 · 23/100 used | Ends | 31 Dec 2026 -> 15 Jan 2027',
        ])
        expect(prepared.plan).toEqual({ steps: [{ op: 'update', discountId: 1, data: { value: 15, description: 'Mid year sale', usageLimit: 200, expiresAt: '2027-01-15' } }], base: { '1': 'u1' } })
        expect(prepared.risk).toBe('medium')
    })

    it('changes between % and RM only with the new amount, and drops a limit, an end date or a site on request', async () => {
        expect((await draft([{ ...update, discountId: '2', type: 'percentage' }])).error).toMatchObject({ code: 'amount_needed' })
        expect((await draft([{ ...update, usageLimit: 5, removeLimit: true }])).error).toMatchObject({ code: 'invalid_input' })

        const prepared = await draft([{ ...update, discountId: '6', removeEnd: true, allSites: true }, { ...update, discountId: '1', removeLimit: true }])

        expect(rows(prepared)).toEqual(expect.arrayContaining([
            expect.stringContaining('Ends | 30 Oct 2026 -> No end date'),
            expect.stringContaining('Applies to | Kedai Batik -> All sites'),
            expect.stringContaining('Usage limit | Up to 100 uses (23 used so far) -> No limit'),
        ]))
        expect(prepared.plan).toMatchObject({ steps: [{ data: { expiresAt: null, site: null } }, { data: { usageLimit: null } }] })
    })

    it('renames a code but not to one that exists', async () => {
        expect((await draft([{ ...update, code: 'raya5' }])).error).toMatchObject({ code: 'code_taken' })
        expect(rows(await draft([{ ...update, code: 'summer11' }]))[0]).toContain('Code | SUMMER10 -> SUMMER11')
    })

    it('calls a description-only change low risk and anything shoppers feel at checkout medium', async () => {
        const note = await draft([updateStep({ description: 'Mid year sale' })])
        const price = await draft([updateStep({ amount: 12 })])

        expect(note.risk).toBe('low')
        expect(note.guardrails?.map((g) => g.rule)).not.toContain('live')
        expect(price.risk).toBe('medium')
    })

    it('switches a paused code on, and a live one off', async () => {
        const off = await draft([{ op: 'pause', discountId: '2' }])
        const on = await draft([{ op: 'activate', discountId: '5' }, { op: 'pause', discountId: '1' }])

        expect(off.title).toBe('Pause discount: RAYA5')
        expect(off.risk).toBe('low')
        expect(rows(off)).toEqual(['RAYA5 · RM 5.00 off · no end date · 0 used | Status | Active -> Inactive (paused)'])
        expect((await draft([{ op: 'activate', discountId: '2' }])).error).toMatchObject({ code: 'no_change', message: expect.stringContaining('already switched on') })
        // NEWYEAR is already active (it starts on 1 Jan): nothing to do for it, SUMMER10 is paused
        expect(on.plan).toMatchObject({ steps: [{ op: 'update', discountId: 1, data: { status: 'inactive' } }] })
    })

    it('holds the form\'s activation guard: an ended code or one at its limit cannot be switched on', async () => {
        expect((await draft([{ op: 'activate', discountId: '3' }])).error).toMatchObject({ code: 'expired_cannot_activate', message: expect.stringMatching(/ended on 30 Sept? 2026/) })
        state.discounts.find((d) => d.id === 4)!.status = 'inactive'
        expect((await draft([{ op: 'activate', discountId: '4' }])).error).toMatchObject({ code: 'at_limit_cannot_activate', message: expect.stringContaining('10 of 10') })
        // an active code cannot be moved to a past end date either
        expect((await draft([{ ...update, endsOn: '2026-10-01' }])).error).toMatchObject({ code: 'expired_cannot_activate' })
        // a limit below what was used makes an active code unusable: refused; raising it first is fine
        expect((await draft([{ ...update, usageLimit: 20 }])).error).toMatchObject({ code: 'at_limit_cannot_activate', message: expect.stringContaining('23 of 20') })
        expect((await draft([{ ...update, usageLimit: 200 }])).error).toBeUndefined()
        expect((await draft([{ ...update, discountId: '4', usageLimit: 20 }, { op: 'activate', discountId: '4' }])).error).toBeUndefined()
    })

    it('lets the same card give an ended code a new end date and then switch it on', async () => {
        const prepared = await draft([{ ...update, discountId: '3', endsOn: '2026-11-15' }, { op: 'activate', discountId: '3' }])

        expect(prepared.error).toBeUndefined()
        expect(prepared.title).toBe('Change 2 discounts')
        expect(rows(prepared)).toEqual([
            'OLD20 · 20% off · until 30 Sep 2026 · 5 used · inactive | Ends | 30 Sep 2026 -> 15 Nov 2026',
            'OLD20 · 20% off · until 30 Sep 2026 · 5 used · inactive | Status | Inactive -> Active',
        ])
    })

    it('asks for the code to delete it, says what stays, and refuses a code that is gone', async () => {
        const prepared = await draft([{ op: 'delete', discountId: '1' }, { op: 'delete', discountId: '3' }])

        expect(prepared.confirmText).toBe('SUMMER10, OLD20')
        expect(prepared.risk).toBe('high')
        expect(rows(prepared)[0]).toContain('Deleted | Used 23 times -> Deleted — the code stops working')
        expect(prepared.guardrails?.map((g) => g.detail).join(' ')).toContain('Orders already placed keep what they paid. SUMMER10, OLD20 were used')
        expect((await draft([{ op: 'delete', discountId: '1' }, { op: 'pause', discountId: '1' }])).error).toMatchObject({ code: 'unknown_discount' })
        expect((await draft([{ op: 'delete', discountId: '999' }])).error).toMatchObject({ code: 'unknown_discount' })
    })

    it('frees a deleted code inside the card, and refuses a card that changes nothing', async () => {
        expect((await draft([{ op: 'delete', discountId: '2' }, { op: 'create', code: 'RAYA5', type: 'fixed', amount: 6, description: null, usageLimit: null, startsOn: null, endsOn: null, siteId: null, status: null }])).error).toBeUndefined()
        expect((await draft([{ ...update, description: 'x'.repeat(10), discountId: '2' }, { ...update, discountId: '2' }])).error).toBeUndefined()
        expect((await draft([{ ...update, amount: 10 }])).error).toMatchObject({ code: 'no_change' })
    })

    it('rejects a malformed card at the boundary', async () => {
        await expect(draft([])).rejects.toThrow()
        await expect(draft([{ op: 'create', code: 'X' }])).rejects.toThrow()
        await expect(draft(Array.from({ length: 11 }, () => ({ op: 'pause', discountId: '1' })))).rejects.toThrow()
        await expect(draft([{ op: 'pause', discountId: '1; drop' }])).rejects.toThrow()
        await expect(draft([{ ...update, endsOn: '2026-02-31' }])).rejects.toThrow()
    })
})

describe('applying a discount change [TC-AICP-148]', () => {
    it('writes with the discount core as the approver in the drafted workspace and records the undo', async () => {
        const prepared = await draft([
            { op: 'create', code: 'RAYA10', type: 'percentage', amount: 10, description: null, usageLimit: null, startsOn: null, endsOn: null, siteId: null, status: null },
            { op: 'pause', discountId: '2' },
            { op: 'delete', discountId: '3' },
        ])

        const result = await applyStoreDiscountsPatch(prepared.plan, actor, NOW)

        const service = { user: (actor as { user: unknown }).user, tenantId: '1', strictTenant: true }
        expect(createDiscountAs).toHaveBeenCalledWith(service, expect.objectContaining({ code: 'RAYA10', value: 10, status: 'active' }))
        expect(updateDiscountAs).toHaveBeenCalledWith(service, 2, { status: 'inactive' })
        expect(deleteDiscountAs).toHaveBeenCalledWith(service, 3)
        expect(result.entities).toEqual([{ kind: 'store_discount', id: '100' }, { kind: 'store_discount', id: '2' }])
        // several codes open the list [TC-AICP-246]
        expect(result.links).toEqual([{ label: 'Open discounts', href: '/discounts' }])
        expect(result.undo).toMatchObject({
            kind: 'store.discounts_restore',
            payload: {
                ops: [
                    { op: 'created', id: 100 },
                    { op: 'updated', id: 2, before: { code: 'RAYA5', status: 'active', type: 'fixed', value: 500, usageLimit: null, startsAt: null, expiresAt: null, site: null, description: 'Raya gift' } },
                    { op: 'deleted', row: { code: 'OLD20', usageCount: 5, expiresAt: '2026-09-30', status: 'inactive' } },
                ],
            },
        })
    })

    it('links one changed code to its own page [TC-AICP-246]', async () => {
        const result = await applyStoreDiscountsPatch((await draft([{ op: 'pause', discountId: '2' }])).plan, actor, NOW)

        expect(result.links).toEqual([{ label: 'Open discount', href: '/discounts/2' }])
    })

    it('overwrites nothing edited since the draft', async () => {
        const prepared = await draft([{ op: 'pause', discountId: '2' }])
        state.discounts.find((d) => d.id === 2)!.updatedAt = 'edited'

        await expect(applyStoreDiscountsPatch(prepared.plan, actor, NOW)).rejects.toMatchObject({ status: 409 })
        expect(state.calls).toEqual([])
    })

    it('runs the activation guard again at approval: the end date it set may have passed since the draft', async () => {
        const later = new Date('2026-11-05T04:00:00Z')
        const dated = await draft([updateStep({ discountId: '6', endsOn: '2026-11-02' })])
        const valueOnly = await draft([updateStep({ discountId: '6', amount: 7 })])

        await expect(applyStoreDiscountsPatch(dated.plan, actor, later)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('ended on 2 Nov 2026') })
        expect(state.calls).toEqual([])
        // a value-only change does not touch what the guard reads
        await expect(applyStoreDiscountsPatch(valueOnly.plan, actor, later)).resolves.toBeDefined()
        expect(updateDiscountAs).toHaveBeenCalledWith(expect.anything(), 6, { value: 7 })
    })

    it('explains a code that was taken meanwhile, and puts back what already ran', async () => {
        const prepared = await draft([
            { op: 'pause', discountId: '2' },
            { op: 'create', code: 'RAYA10', type: 'percentage', amount: 10, description: null, usageLimit: null, startsOn: null, endsOn: null, siteId: null, status: null },
        ])
        state.failOn = { fn: 'create', error: new DiscountServiceError('DUPLICATE_CODE', 'dup') }

        await expect(applyStoreDiscountsPatch(prepared.plan, actor, NOW)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('pick another code') })
        // the pause was undone: RAYA5 is active again
        expect(state.discounts.find((d) => d.id === 2)).toMatchObject({ status: 'active' })
        expect(state.calls.map((c) => c.fn)).toEqual(['update', 'create', 'update'])
    })

    it('refuses a plan it did not draft (unknown steps, a made-up status) and a workspace switch', async () => {
        await expect(applyStoreDiscountsPatch({ steps: [{ op: 'drop' }], base: {} }, actor, NOW)).rejects.toThrow()
        await expect(applyStoreDiscountsPatch({ steps: [{ op: 'update', discountId: 2, data: { status: 'banana' } }], base: {} }, actor, NOW)).rejects.toThrow()
        await expect(applyStoreDiscountsPatch({ steps: [{ op: 'delete', discountId: 2 }], base: {} }, { ...(actor as object), tenantId: '2' } as never, NOW)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('workspace') })
        expect(state.calls).toEqual([])
    })
})

describe('undoing a discount change [TC-AICP-149]', () => {
    const service = { user: { id: 3, tenants: [member] }, tenantId: '1', strictTenant: true }
    const written = (over: Record<string, unknown> = {}) => ({ code: 'RAYA5', description: 'Raya gift', type: 'fixed', value: 500, status: 'active', usageLimit: null, startsAt: null, expiresAt: null, site: null, ...over })

    it('goes back newest first: a made code removed, an edited one restored, a deleted one made again with its usage', async () => {
        await applyStoreDiscountsRestore(
            { ops: [{ op: 'created', id: 6, updatedAt: 'u6' }, { op: 'updated', id: 2, updatedAt: 'u2', before: written({ status: 'inactive' }) }, { op: 'deleted', row: { ...written({ code: 'GONE', value: 20, type: 'percentage' }), usageCount: 7 } }] },
            actor,
        )

        expect(state.calls.map((c) => c.fn)).toEqual(['create', 'update', 'delete'])
        expect(createDiscountAs).toHaveBeenCalledWith(service, expect.objectContaining({ code: 'GONE', usageCount: 7 }))
        expect(updateDiscountAs).toHaveBeenCalledWith(service, 2, expect.objectContaining({ status: 'inactive', code: 'RAYA5' }))
        expect(deleteDiscountAs).toHaveBeenCalledWith(service, 6)
    })

    it('does nothing once a discount was edited since the change, or when a deleted code is used again', async () => {
        // RAYA5 reads neither as the change left it (stamp) nor as before it (value 999)
        await expect(applyStoreDiscountsRestore({ ops: [{ op: 'updated', id: 2, updatedAt: 'older', before: written({ value: 999 }) }] }, actor)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('edited after this change') })
        await expect(applyStoreDiscountsRestore({ ops: [{ op: 'deleted', row: { ...written({ code: 'summer10' }), usageCount: 0 } }] }, actor)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('SUMMER10') })
        expect(state.calls).toEqual([])
    })

    it('lets an earlier change be undone after a later change to the same code was undone (new stamp, same values)', async () => {
        // the stamp moved (the later undo wrote the code again) but it reads exactly as this change left it
        await applyStoreDiscountsRestore({ ops: [{ op: 'updated', id: 2, updatedAt: 'older', after: written(), before: written({ status: 'inactive' }) }] }, actor)
        expect(updateDiscountAs).toHaveBeenCalledWith(service, 2, expect.objectContaining({ status: 'inactive' }))

        // ...but values that differ from what this change left are an edit
        vi.clearAllMocks()
        await expect(applyStoreDiscountsRestore({ ops: [{ op: 'updated', id: 2, updatedAt: 'older', after: written({ value: 600 }), before: written() }] }, actor)).rejects.toMatchObject({ status: 409 })
        expect(updateDiscountAs).not.toHaveBeenCalled()
    })

    it('frees a code the same change made, so a deleted one with that code can come back', async () => {
        state.discounts.push({ id: 50, code: 'AGAIN', type: 'percentage', value: 5, status: 'active', usageCount: 0, updatedAt: 'u50' })

        await applyStoreDiscountsRestore({ ops: [{ op: 'deleted', row: { ...written({ code: 'again' }), usageCount: 0 } }, { op: 'created', id: 50, updatedAt: 'u50' }] }, actor)

        expect(state.calls.map((c) => c.fn)).toEqual(['delete', 'create'])
    })
})

describe('money and access of discount cards [TC-AICP-259..260]', () => {
    const asRole = (member: Record<string, unknown>) => ({ user: { id: 3, tenants: [member] }, tenantId: '1', organizationId: 'org_1' }) as never
    const newCode = { op: 'create', code: 'FREE50', type: 'percentage', amount: 50, description: null, usageLimit: null, startsOn: null, endsOn: null, siteId: null, status: null }

    it('flags a card that makes a code live as requiresClick so Auto-approve never applies it [TC-AICP-259]', async () => {
        const created = await draft([newCode])
        const paused = await draft([{ ...newCode, code: 'LATER', status: 'paused' }])
        const descriptionOnly = await draft([updateStep({ discountId: '2', description: 'Raya gift!' })])
        const changedWhileLive = await draft([updateStep({ discountId: '2', amount: 8, type: 'fixed' })])
        // OLD20 is paused with an end date in the past: give it a new end date and switch it on in one card
        const reactivated = await draft([updateStep({ discountId: '3', endsOn: '2026-12-31' }), { op: 'activate', discountId: '3' }])
        const deleted = await draft([{ op: 'delete', discountId: '2' }])

        expect(created).toMatchObject({ risk: 'medium', requiresClick: true })
        expect(changedWhileLive.requiresClick).toBe(true)
        expect(reactivated.requiresClick).toBe(true)
        // a paused new code and a description touch nothing at checkout
        expect(paused.requiresClick).toBeUndefined()
        expect(descriptionOnly.requiresClick).toBeUndefined()
        // delete keeps its typed code
        expect(deleted).toMatchObject({ confirmText: 'RAYA5' })
    })

    it('needs the Orders permission (the sidebar permission of Discounts) to read, draft and apply; a viewer still reads [TC-AICP-260]', async () => {
        const productsOnly = asRole({ tenant: 1, status: 'active', role: 'custom', permissions: ['products'] })
        const withOrders = asRole({ tenant: 1, status: 'active', role: 'custom', permissions: ['orders'] })
        const viewer = asRole({ tenant: 1, status: 'active', role: 'viewer' })

        expect(await readStoreDiscounts(productsOnly, {}, NOW)).toMatchObject({ error: { code: 'forbidden' } })
        expect(await prepareStoreDiscounts(productsOnly, { why: 'x', changes: [newCode] }, NOW)).toMatchObject({ error: { code: 'forbidden', message: expect.stringContaining('Orders permission') } })
        await expect(applyStoreDiscountsPatch({ steps: [{ op: 'delete', discountId: 2 }], base: {} }, productsOnly, NOW)).rejects.toMatchObject({ status: 403 })
        await expect(applyStoreDiscountsRestore({ ops: [{ op: 'created', id: 6, updatedAt: 'u6' }] }, productsOnly)).rejects.toMatchObject({ status: 403 })
        expect(state.calls).toEqual([])

        expect(await readStoreDiscounts(withOrders, {}, NOW)).toHaveProperty('discounts')
        expect(await readStoreDiscounts(viewer, {}, NOW)).toHaveProperty('discounts')
        expect(await prepareStoreDiscounts(withOrders, { why: 'x', changes: [newCode] }, NOW)).toMatchObject({ kind: 'store.discounts_patch' })
    })

    it('refuses to undo a created code that buyers used (usage count or usage history), and says so [TC-AICP-261]', async () => {
        // SUMMER10 (id 1) has usageCount 23
        await expect(applyStoreDiscountsRestore({ ops: [{ op: 'created', id: 1, updatedAt: 'u1' }] }, actor)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('SUMMER10 was already used (23 times)') })
        // SOON (id 6) has count 0 but two usage-history rows (orders hold slots)
        state.history[6] = 2
        await expect(applyStoreDiscountsRestore({ ops: [{ op: 'created', id: 6, updatedAt: 'u6' }] }, actor)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('already used (2 times)') })
        expect(state.calls).toEqual([])

        // unused: removed as before
        state.history = {}
        await applyStoreDiscountsRestore({ ops: [{ op: 'created', id: 6, updatedAt: 'u6' }] }, actor)
        expect(deleteDiscountAs).toHaveBeenCalledTimes(1)
    })
})

describe('discount card hardening [TC-AISEC-104, TC-AISEC-105, TC-AISEC-107]', () => {
    const newCode = { op: 'create', code: 'RAYA10', type: 'percentage', amount: 10, description: null, usageLimit: null, startsOn: null, endsOn: null, siteId: null, status: null }

    it('closes (final, stale) a card whose discount was edited or deleted since the draft [TC-AISEC-107]', async () => {
        const prepared = await draft([{ op: 'pause', discountId: '2' }])
        state.discounts = state.discounts.filter((d) => d.id !== 2)

        const error = await applyStoreDiscountsPatch(prepared.plan, actor, NOW).catch((e) => e)

        expect(error).toMatchObject({ status: 409, final: true, stale: true })
        expect(state.calls).toEqual([])
    })

    it('a code taken meanwhile stays a non-final refusal (the merchant can pick another and approve) [TC-AISEC-107]', async () => {
        const prepared = await draft([newCode])
        state.failOn = { fn: 'create', error: new DiscountServiceError('DUPLICATE_CODE', 'dup') }

        await expect(applyStoreDiscountsPatch(prepared.plan, actor, NOW)).rejects.toMatchObject({ status: 409, final: false })
    })

    it('when putting back a half-run change fails too, the card closes saying what is still in place, and it is logged [TC-AISEC-105]', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const prepared = await draft([newCode, { op: 'pause', discountId: '2' }])
        state.failOn = { fn: 'update', error: new DiscountServiceError('VALIDATION', 'The pause was refused.') }
        vi.mocked(deleteDiscountAs).mockRejectedValueOnce(new Error('connection reset'))

        const error = await applyStoreDiscountsPatch(prepared.plan, actor, NOW).catch((e) => e)

        expect(error).toMatchObject({ status: 422, final: true })
        expect(error.message).toContain('The pause was refused.')
        expect(error.message).toContain('Done: created RAYA10, could not put back: RAYA10')
        expect(state.discounts.some((d) => d.code === 'RAYA10')).toBe(true)
        expect(log).toHaveBeenCalledWith(expect.stringContaining('write refused'), 'connection reset')
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Discounts: a failed change could not be put back'), expect.stringContaining('RAYA10'))
        log.mockRestore()
    })

    it('an undo that already ran (record lost, second tab) succeeds again without writing [TC-AISEC-104]', async () => {
        const prepared = await draft([newCode, { op: 'pause', discountId: '2' }, { op: 'delete', discountId: '3', confirm: 'OLD20' }])
        const result = await applyStoreDiscountsPatch(prepared.plan, actor, NOW)
        await applyStoreDiscountsRestore(result.undo!.payload, actor)
        state.calls = []

        await expect(applyStoreDiscountsRestore(result.undo!.payload, actor)).resolves.toMatchObject({ links: [{ href: '/discounts' }] })

        expect(state.calls).toEqual([])
        expect(state.discounts.find((d) => d.id === 2)).toMatchObject({ status: 'active' })
        expect(state.discounts.filter((d) => d.code === 'OLD20')).toHaveLength(1)
        expect(state.discounts.some((d) => d.code === 'RAYA10')).toBe(false)
    })
})
