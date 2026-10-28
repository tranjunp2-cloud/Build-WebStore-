/**
 * TC-AIREL-216 — stock pictures the copilot saved for a shop (Pixabay rows carrying that shop's `tenant`) can be edited
 * and deleted by that shop's members; the shared stock library (no tenant) and other shops' stock rows stay out of
 * reach, and the provenance fields stay system-only.
 * Real: the Media collection's update / delete access and field access.
 * Faked: nothing; the returned `where` is evaluated against sample rows by a small interpreter.
 */
import { describe, expect, it } from 'vitest'
import { Media } from '@/collections/Media'

type Row = Record<string, unknown>
function matches(row: Row, where: unknown): boolean {
    return Object.entries(where as Row).every(([key, cond]) => {
        if (key === 'and') return (cond as unknown[]).every((c) => matches(row, c))
        if (key === 'or') return (cond as unknown[]).some((c) => matches(row, c))
        const [op, expected] = Object.entries(cond as Row)[0]!
        const got = row[key] ?? null
        if (op === 'exists') return (got !== null) === Boolean(expected)
        if (op === 'equals') return String(got) === String(expected)
        if (op === 'in') return got !== null && (expected as unknown[]).some((e) => String(e) === String(got))
        if (op === 'not_in') return got === null || !(expected as unknown[]).some((e) => String(e) === String(got))
        throw new Error(`unsupported where operator ${op}`)
    })
}

const member = (...tenants: Array<number | string>) => ({ id: 3, roles: ['user'], tenants: tenants.map((id) => ({ tenant: { id }, roles: ['tenant-owner'] })) })
const access = (kind: 'update' | 'delete', user: unknown) => (Media.access![kind] as (args: unknown) => unknown)({ req: { user } })

const ROWS = {
    plain: { id: 1, tenant: 4 },
    ai: { id: 2, tenant: 4, sourceProvider: 'ai' },
    ownStock: { id: 3, tenant: 4, sourceProvider: 'pixabay' },
    ownWikimedia: { id: 4, tenant: 4, sourceProvider: 'wikimedia' },
    otherStock: { id: 5, tenant: 9, sourceProvider: 'pixabay' },
    sharedStock: { id: 6, tenant: null, sourceProvider: 'pixabay' },
    sharedWikimedia: { id: 7, tenant: null, sourceProvider: 'wikimedia' },
    legacyPlain: { id: 8, tenant: null },
}
const allowed = (kind: 'update' | 'delete', user: unknown) => {
    const where = access(kind, user)
    return Object.entries(ROWS).filter(([, row]) => where && matches(row, where)).map(([name]) => name)
}

describe('stock rows of the member\'s own workspace [TC-AIREL-216]', () => {
    it.each(['update', 'delete'] as const)('%s: own stock rows yes, the shared stock library and other shops\' stock rows no', (kind) => {
        expect(allowed(kind, member(4))).toEqual(['plain', 'ai', 'ownStock', 'ownWikimedia', 'legacyPlain'])
    })

    it('a member of several workspaces may touch the stock rows of each, and of no other', () => {
        expect(allowed('delete', member(4, 9))).toEqual(['plain', 'ai', 'ownStock', 'ownWikimedia', 'otherStock', 'legacyPlain'])
        expect(allowed('delete', member('4'))).toContain('ownStock')
    })

    it('a user in no workspace, and a visitor, get no stock row at all', () => {
        expect(allowed('update', member())).toEqual(['plain', 'ai', 'legacyPlain'])
        expect(access('update', null)).toBe(false)
        expect(access('delete', undefined)).toBe(false)
    })

    it('does not change who may touch rows that are not stock (unchanged rule)', () => {
        for (const user of [member(4), member(9), member()]) expect(allowed('update', user)).toEqual(expect.arrayContaining(['plain', 'ai', 'legacyPlain']))
    })

    it('keeps the provenance fields system-only whoever may update the row', () => {
        const fields = Media.fields as Array<{ name?: string; access?: { create?: () => boolean; update?: () => boolean } }>
        for (const name of ['sourceProvider', 'sourceUrl', 'licenseName', 'licenseUrl', 'attribution']) {
            const field = fields.find((candidate) => candidate.name === name)
            expect(field?.access?.create?.()).toBe(false)
            expect(field?.access?.update?.()).toBe(false)
        }
        // the owner never changes after the upload
        const tenant = fields.find((candidate) => candidate.name === 'tenant')
        expect(tenant?.access?.update?.()).toBe(false)
    })
})
