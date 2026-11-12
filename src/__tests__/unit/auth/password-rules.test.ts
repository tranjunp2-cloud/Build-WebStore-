// @vitest-environment node
/**
 * Shared password rules (GH-2269): minimum length 6 + reset-password strength score.
 * TC-F02.68 (docs/qa/F02-auth.md).
 */
import { describe, it, expect } from 'vitest'
import { PASSWORD_MIN_LENGTH, getPasswordStrength } from '@/lib/auth/password-rules'

describe('password rules', () => {
    it('[TC-F02.68] minimum length is 6', () => {
        // Assert
        expect(PASSWORD_MIN_LENGTH).toBe(6)
    })

    it('[TC-F02.68] 5 lowercase characters get no length point, 6 do', () => {
        // Act + Assert
        expect(getPasswordStrength('abcde')).toBe(0)
        expect(getPasswordStrength('abcdef')).toBe(1)
    })

    it('[TC-F02.68] scores one point per rule: length, uppercase, digit, special', () => {
        // Act + Assert
        expect(getPasswordStrength('')).toBe(0)
        expect(getPasswordStrength('Abcdef')).toBe(2)
        expect(getPasswordStrength('Abcde1')).toBe(3)
        expect(getPasswordStrength('Abcd1!')).toBe(4)
    })

    it('[TC-F02.68] a short password still scores its complexity, without the length point', () => {
        // Act + Assert
        expect(getPasswordStrength('Ab1!')).toBe(3)
    })
})
