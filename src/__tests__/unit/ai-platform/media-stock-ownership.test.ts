/**
 * TC-AIREL-216 — stock pictures the copilot saved for a shop (Pixabay rows carrying that shop's `tenant`) can be edited
 * and deleted by that shop's members; the shared stock library (no tenant) and other shops' stock rows stay out of
 * reach, and the provenance fields stay system-only. Since TC-PERF-144 the same own-tenant rule covers every row:
 * another shop's files and legacy rows without a tenant are not editable by a member either.
 * TC-AICP-352 — only an ACTIVE membership counts (missing status = active): a pending or suspended member can not
 * edit / delete the shop's stock rows nor upload into its library.
 * Real: the Media collection's update / delete access, field access and the upload tenant (resolveMediaTenant).
 * Faked: nothing; the returned `where` is evaluated against sample rows by a small interpreter.
 */
import { describe, expect, it } from 'vitest'
import { Media, resolveMediaTenant } from '@/collections/Media'

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
        expect(allowed(kind, member(4))).toEqual(['plain', 'ai', 'ownStock', 'ownWikimedia'])
    })

    it('a member of several workspaces may touch the stock rows of each, and of no other', () => {
        expect(allowed('delete', member(4, 9))).toEqual(['plain', 'ai', 'ownStock', 'ownWikimedia', 'otherStock'])
        expect(allowed('delete', member('4'))).toContain('ownStock')
    })

    it('a user in no workspace, and a visitor, get no row at all', () => {
        expect(access('update', member())).toBe(false)
        expect(access('update', null)).toBe(false)
        expect(access('delete', undefined)).toBe(false)
    })

    it('[TC-PERF-144] rows that are not stock follow the same own-tenant rule; legacy rows without a tenant are nobody\'s', () => {
        expect(allowed('update', member(9))).toEqual(['otherStock'])
        for (const user of [member(4), member(9)]) expect(allowed('update', user)).not.toContain('legacyPlain')
    })

    it('keeps the provenance fields system-only whoever may update the row', () => {
        const fields = Media.fields as Array<{ name?: string; access?: { create?: () => boolean; update?: () => boolean } }>
        for (const name of ['sourceProvider', 'sourceUrl', 'licenseName', 'licenseUrl', 'attribution']) {
            const field = fields.find((candidate) => candidate.name === name)
            expect(field?.access?.create?.()).toBe(false)
            expect(field?.access?.update?.()).toBe(false)
        }
        // the owner never changes after the upload (platform admins aside)
        const tenant = fields.find((candidate) => candidate.name === 'tenant') as { access?: { update?: (args: unknown) => boolean } } | undefined
        expect(tenant?.access?.update?.({ req: { user: member(4) } })).toBe(false)
    })
})

describe('only active memberships count [TC-AICP-352]', () => {
    const withStatus = (status: string | undefined, ...more: Array<{ tenant: unknown; status?: string }>) => ({
        id: 3,
        roles: ['user'],
        tenants: [{ tenant: { id: 4 }, ...(status === undefined ? {} : { status }) }, ...more],
    })

    it.each(['pending', 'suspended'])('[TC-AICP-352] a %s member gets no stock row of that shop', (status) => {
        // Arrange
        const user = withStatus(status)

        // Act
        const rows = allowed('delete', user)

        // Assert: their only membership is inactive, so no row at all
        expect(rows).toEqual([])
    })

    it('[TC-AICP-352] an active member, and one whose membership has no status, keep their stock rows', () => {
        // Act + Assert
        expect(allowed('update', withStatus('active'))).toContain('ownStock')
        expect(allowed('update', withStatus(undefined))).toContain('ownStock')
    })

    it('[TC-AICP-352] an upload never lands in a shop the user is only pending / suspended in', () => {
        // Arrange: pending in 4 (first), active in 9
        const user = withStatus('pending', { tenant: 9, status: 'active' })

        // Act
        const asked = resolveMediaTenant(user, 4)
        const fallback = resolveMediaTenant(user, undefined)
        const onlyPending = resolveMediaTenant(withStatus('suspended'), 4)

        // Assert
        expect(asked).toBe(9)
        expect(fallback).toBe(9)
        expect(onlyPending).toBeNull()
    })
})
