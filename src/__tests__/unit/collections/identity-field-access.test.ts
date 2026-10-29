/**
 * TC-AISEC-001..003 — fields every tenant check trusts are closed to requests.
 * - Users.tenants: a PATCH /api/users/<own id> with a membership made the caller owner of any workspace
 *   (GH-1587 "Bug F"); the copilot, appliers and dashboard all trust this list.
 * - Tenants.metaData: `platformOrgId` picks the AI platform org of the workspace's tokens; a member could
 *   point their workspace at another shop's org and read its change sets.
 * - Users.otp*: the hash is sha256 of 6 digits; reading or writing it would skip the OTP step.
 * Server flows write these through the Local API (overrideAccess), which field access does not apply to.
 * Audit: plans/261022-ai-security-reliability-600-users/audit.md
 */
import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'
import { Tenants } from '@/collections/Tenants'
import { Users } from '@/collections/Users'

type FieldAccessFn = (args: never) => boolean | Promise<boolean>
type WithAccess = { access?: { read?: FieldAccessFn; create?: FieldAccessFn; update?: FieldAccessFn } }

const field = (fields: Field[], name: string) => fields.find((f) => 'name' in f && f.name === name) as WithAccess
const as = (user: unknown) => ({ req: { user } }) as never

const owner = { id: 7, roles: ['tenant-owner'], tenants: [{ tenant: 1, role: 'owner', status: 'active' }] }
const superAdmin = { id: 1, roles: ['super-admin'] }

describe('Users.tenants field access [TC-AISEC-001]', () => {
    const access = field(Users.fields, 'tenants').access!

    it('refuses create and update to a signed-in user, a visitor and a tenant owner', async () => {
        for (const user of [null, owner, { id: 9, roles: [] }]) {
            expect(await access.create!(as(user))).toBe(false)
            expect(await access.update!(as(user))).toBe(false)
        }
    })

    it('lets a super-admin write memberships (admin panel)', async () => {
        expect(await access.create!(as(superAdmin))).toBe(true)
        expect(await access.update!(as(superAdmin))).toBe(true)
    })

    it('keeps the profile fields writable by the user (Settings → Profile still saves)', () => {
        for (const name of ['firstName', 'lastName', 'phone']) {
            expect(field(Users.fields, name).access).toBeUndefined()
        }
    })
})

describe('Tenants.metaData field access [TC-AISEC-002]', () => {
    const access = field(Tenants.fields, 'metaData').access!

    it('refuses create and update to members of the workspace, super-admin only', async () => {
        expect(await access.create!(as(owner))).toBe(false)
        expect(await access.update!(as(owner))).toBe(false)
        expect(await access.update!(as(null))).toBe(false)
        expect(await access.update!(as(superAdmin))).toBe(true)
    })
})

describe('Users OTP field access [TC-AISEC-003]', () => {
    it('never returns the OTP hash to a request, even to its own user', async () => {
        expect(await field(Users.fields, 'otpHash').access!.read!(as(owner))).toBe(false)
    })

    it('lets no request write the OTP fields, whoever asks', async () => {
        for (const name of ['otpHash', 'otpExpiresAt', 'otpAttempts']) {
            const access = field(Users.fields, name).access!
            for (const user of [owner, superAdmin]) {
                expect(await access.create!(as(user))).toBe(false)
                expect(await access.update!(as(user))).toBe(false)
            }
        }
    })
})

describe('Tenants update access [TC-AISEC-031]', () => {
    const update = Tenants.access!.update as (args: never) => unknown
    const member = (role: string, status?: string) => ({
        id: 7,
        roles: ['tenant-owner'],
        tenants: [{ tenant: { id: 1 }, role, ...(status ? { status } : {}) }, { tenant: 2, role: 'viewer', status: 'active' }],
    })

    it('lets active owners and admins update their own workspace only', async () => {
        expect(await update(as(member('owner', 'active')))).toEqual({ id: { in: [1] } })
        expect(await update(as(member('admin')))).toEqual({ id: { in: [1] } })
    })

    it('gives viewers, editors, custom roles and pending or suspended members no workspace to update', async () => {
        for (const user of [member('viewer', 'active'), member('editor', 'active'), member('custom', 'active'), member('owner', 'pending'), member('owner', 'suspended')]) {
            expect(await update(as(user))).toEqual({ id: { in: [] } })
        }
        expect(await update(as(null))).toEqual({ id: { in: [] } })
    })

    it('keeps super-admins able to update every workspace', async () => {
        expect(await update(as(superAdmin))).toBe(true)
    })
})
