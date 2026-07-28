import { describe, expect, it } from 'vitest'
import {
    deriveE2EProfileStaffEmail,
    isE2EProfileIdentity,
    isValidE2EProfileOtp,
} from '@/lib/otp/e2e-profile-bypass'

// ── TC-F23-05-10: Profile E2E identity isolation ────────────────────────
describe('[TC-F23-05-10] profile E2E identity isolation', () => {
    it('derives a dedicated Staff alias from the configured Owner email', () => {
        // Arrange
        const ownerEmail = 'E2E-Bot@PrimeWeb.App'

        // Act
        const staffEmail = deriveE2EProfileStaffEmail(ownerEmail)

        // Assert
        expect(staffEmail).toBe('e2e-bot+profile-staff@primeweb.app')
    })

    it('accepts only the configured Owner and its dedicated Staff alias', () => {
        // Arrange
        const ownerEmail = 'e2e-bot@primeweb.app'
        const staffEmail = deriveE2EProfileStaffEmail(ownerEmail)

        // Act
        const ownerAccepted = isE2EProfileIdentity(ownerEmail, ownerEmail)
        const staffAccepted = isE2EProfileIdentity(staffEmail, ownerEmail)
        const customerAccepted = isE2EProfileIdentity('customer@example.com', ownerEmail)

        // Assert
        expect(ownerAccepted).toBe(true)
        expect(staffAccepted).toBe(true)
        expect(customerAccepted).toBe(false)
    })

    it('requires the exact E2E OTP code for both permitted identities', () => {
        // Arrange
        const ownerEmail = 'e2e-bot@primeweb.app'
        const staffEmail = deriveE2EProfileStaffEmail(ownerEmail)

        // Act
        const ownerValid = isValidE2EProfileOtp(ownerEmail, '123456', ownerEmail, '123456', 'staging')
        const staffValid = isValidE2EProfileOtp(staffEmail, '123456', ownerEmail, '123456', 'staging')
        const wrongCodeValid = isValidE2EProfileOtp(staffEmail, '000000', ownerEmail, '123456', 'staging')

        // Assert
        expect(ownerValid).toBe(true)
        expect(staffValid).toBe(true)
        expect(wrongCodeValid).toBe(false)
    })

    it('refuses the fixed E2E OTP outside staging even when all identities and codes match', () => {
        // Arrange
        const ownerEmail = 'e2e-bot@primeweb.app'
        const staffEmail = deriveE2EProfileStaffEmail(ownerEmail)

        // Act
        const productionAccepted = isValidE2EProfileOtp(
            staffEmail,
            '123456',
            ownerEmail,
            '123456',
            'production',
        )
        const missingEnvAccepted = isValidE2EProfileOtp(
            staffEmail,
            '123456',
            ownerEmail,
            '123456',
            undefined,
        )

        // Assert
        expect(productionAccepted).toBe(false)
        expect(missingEnvAccepted).toBe(false)
    })
})
