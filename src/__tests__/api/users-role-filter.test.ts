/**
 * Regression Tests — Users Collection Role Filter Guard (TC-GH1535-01)
 *
 * Bug (GH #1535): `?where[roles][in][]=buyer|staff` reached Postgres as
 * `users_roles.value IN ('buyer')` against the enum column → "invalid input value
 * for enum" → Payload swallowed it into a generic 500.
 * Fix: a `beforeOperation` guard (`rejectInvalidRoleFilter`) scans the query `where`
 * for `roles` values outside the enum and throws APIError(400) before Postgres is hit.
 *
 * These tests exercise the REAL hook wired into the Users collection config
 * (Users.hooks.beforeOperation[0]) — not a re-implementation.
 */
import { describe, it, expect } from 'vitest'
import { APIError } from 'payload'
import { Users } from '@/collections/Users'

// The actual guard as wired into the collection — if it regresses, these fail.
const hook = Users.hooks!.beforeOperation![0]
// The hook only reads `args.where`; pass a minimal operation context.
const run = (where: unknown) =>
    (hook as unknown as (a: { args: { where?: unknown } }) => unknown)({ args: { where } })

describe('TC-GH1535-01: Users roles filter guard (rejectInvalidRoleFilter)', () => {
    describe('TC-GH1535-01a: invalid enum value → APIError 400 (never Postgres 500)', () => {
        it('rejects roles.in containing "buyer"', () => {
            let err: unknown
            try { run({ roles: { in: ['buyer'] } }) } catch (e) { err = e }
            expect(err).toBeInstanceOf(APIError)
            expect((err as APIError).status).toBe(400)
            expect((err as Error).message).toContain('buyer')
        })

        it('rejects roles.in containing "staff"', () => {
            expect(() => run({ roles: { in: ['staff'] } })).toThrow(APIError)
        })

        it('rejects roles.equals with an invalid value', () => {
            expect(() => run({ roles: { equals: 'customer' } })).toThrow(APIError)
        })

        it('rejects roles.not_in with an invalid value (also enum-cast)', () => {
            expect(() => run({ roles: { not_in: ['buyer'] } })).toThrow(APIError)
        })

        it('rejects an invalid value nested under and/or', () => {
            expect(() =>
                run({ and: [{ tenant: { equals: 1 } }, { or: [{ roles: { in: ['buyer'] } }] }] }),
            ).toThrow(APIError)
        })

        it('rejects a mixed valid+invalid list (one bad value fails the query)', () => {
            expect(() => run({ roles: { in: ['viewer', 'buyer'] } })).toThrow(APIError)
        })
    })

    describe('TC-GH1535-01b: valid role filters pass through untouched', () => {
        it('accepts roles.in with only valid values and returns args unchanged', () => {
            const where = { roles: { in: ['viewer', 'tenant-owner'] } }
            expect(() => run(where)).not.toThrow()
            expect(run(where)).toEqual({ where })
        })

        it('accepts roles.equals with a valid value', () => {
            expect(() => run({ roles: { equals: 'super-admin' } })).not.toThrow()
        })

        it('accepts a query with no roles filter', () => {
            expect(() => run({ id: { equals: 5 } })).not.toThrow()
        })

        it('accepts a where-less operation (e.g. findByID)', () => {
            expect(() => run(undefined)).not.toThrow()
        })

        it('ignores unrelated fields (only top-level roles filter is guarded)', () => {
            expect(() =>
                run({ and: [{ email: { contains: 'a' } }, { 'tenants.role': { equals: 'owner' } }] }),
            ).not.toThrow()
        })
    })
})
