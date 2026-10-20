import { describe, it, expect } from 'vitest'
import { canUpdateAvatarField } from '@/lib/profile/avatar-field-access'

// Build the minimal field-access args Payload passes to `access.update`.
const callAccess = (user: unknown) =>
    canUpdateAvatarField({ req: { user } } as Parameters<typeof canUpdateAvatarField>[0])

describe('users.avatar field update access (GH-1723)', () => {
    // TC-F23-SSO-10: Owner cannot mutate avatar via REST/GraphQL self-update
    it('denies Owners', () => {
        // Arrange
        const owner = { roles: ['tenant-owner'], tenants: [{ role: 'owner' }] }

        // Act
        const allowed = callAccess(owner)

        // Assert
        expect(allowed).toBe(false)
    })

    // TC-F23-SSO-10: Staff keep the local avatar flow
    it('allows Staff', () => {
        // Arrange
        const staff = { roles: ['editor'], tenants: [{ role: 'editor' }] }

        // Act
        const allowed = callAccess(staff)

        // Assert
        expect(allowed).toBe(true)
    })

    // TC-F23-SSO-10: super-admin keeps full access even with an owner membership
    it('allows super-admin', () => {
        // Arrange
        const admin = { roles: ['super-admin'], tenants: [{ role: 'owner' }] }

        // Act
        const allowed = callAccess(admin)

        // Assert
        expect(allowed).toBe(true)
    })

    // TC-F23-SSO-10: anonymous requests are denied
    it('denies anonymous requests', () => {
        // Arrange / Act
        const allowed = callAccess(null)

        // Assert
        expect(allowed).toBe(false)
    })
})
