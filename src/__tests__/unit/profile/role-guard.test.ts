import { describe, it, expect } from 'vitest'
import { isOwner, blockOwner } from '@/lib/profile/role-guard'
import { NextResponse } from 'next/server'

describe('isOwner', () => {
    // TC-F23-05-01: Owner detected via roles array
    it('returns true when roles contains tenant-owner', () => {
        const user = {
            roles: ['tenant-owner'],
        }
        const result = isOwner(user)
        expect(result).toBe(true)
    })

    // TC-F23-05-02: Owner detected via tenants role
    it('returns true when tenant has role owner', () => {
        const user = {
            roles: ['editor'],
            tenants: [{ role: 'owner' }],
        }
        const result = isOwner(user)
        expect(result).toBe(true)
    })

    // TC-F23-05-03: Non-owner staff user
    it('returns false for staff user with no owner role', () => {
        const user = {
            roles: ['editor'],
            tenants: [{ role: 'admin' }],
        }
        const result = isOwner(user)
        expect(result).toBe(false)
    })

    // TC-F23-05-04: Empty roles and tenants
    it('returns false when roles and tenants are empty', () => {
        const user = {
            roles: [],
            tenants: [],
        }
        const result = isOwner(user)
        expect(result).toBe(false)
    })

    // TC-F23-05-05: Undefined roles and tenants
    it('returns false when roles and tenants are undefined', () => {
        const user = {}
        const result = isOwner(user)
        expect(result).toBe(false)
    })
})

describe('blockOwner', () => {
    // TC-F23-05-06: Owner returns 403 response
    it('returns 403 NextResponse when user is owner', () => {
        const user = {
            roles: ['tenant-owner'],
            tenants: [{ role: 'owner' }],
        }
        const result = blockOwner(user)
        expect(result).not.toBeNull()
        expect(result).toBeInstanceOf(NextResponse)
        if (result) {
            expect(result.status).toBe(403)
        }
    })

    // TC-F23-05-07: Staff user returns null
    it('returns null when user is staff (not owner)', () => {
        const user = {
            roles: ['editor'],
            tenants: [{ role: 'admin' }],
        }
        const result = blockOwner(user)
        expect(result).toBeNull()
    })

    // TC-F23-05-08: Returns null for user with no owner indicator
    it('returns null when user has no owner indications', () => {
        const user = {
            roles: [],
            tenants: [],
        }
        const result = blockOwner(user)
        expect(result).toBeNull()
    })
})
