import { describe, it, expect } from 'vitest'
import { profilePatchSchema, passwordChangeSchema } from '@/lib/profile/schemas'

describe('profilePatchSchema', () => {
    // TC-F23-04-01: Full valid profile patch
    it('parses valid full profile patch', () => {
        const data = {
            firstName: 'John',
            lastName: 'Doe',
            phone: '+12125551234',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual(data)
        }
    })

    // TC-F23-04-02: Valid partial profile patch
    it('parses valid partial profile patch (firstName only)', () => {
        const data = {
            firstName: 'Jane',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual(data)
        }
    })

    // TC-F23-04-03: Valid with only lastName
    it('parses valid profile patch with only lastName', () => {
        const data = {
            lastName: 'Smith',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual(data)
        }
    })

    // TC-F23-04-31 (GH-2383): empty lastName is valid (staff invited without a name)
    it('accepts empty lastName alongside phone', () => {
        const result = profilePatchSchema.safeParse({ lastName: '', phone: '+60123456789' })
        expect(result.success).toBe(true)
    })

    // TC-F23-04-32 (GH-2383): name errors are i18n keys, not raw zod text
    it('reports nameLength key for 1-char lastName, 51-char lastName and 1-char firstName', () => {
        for (const data of [{ lastName: 'X' }, { lastName: 'a'.repeat(51) }, { firstName: 'X' }]) {
            const result = profilePatchSchema.safeParse(data)
            expect(result.success).toBe(false)
            if (!result.success) expect(result.error.issues[0].message).toBe('nameLength')
        }
    })

    // TC-F23-04-04: Empty firstName fails validation
    it('rejects empty firstName (min length 2)', () => {
        const data = {
            firstName: 'A',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-05: firstName too short (< 2 chars)
    it('rejects firstName with only 1 character', () => {
        const data = {
            firstName: 'X',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-06: lastName too long (> 50 chars)
    it('rejects lastName exceeding 50 characters', () => {
        const data = {
            lastName: 'a'.repeat(51),
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-07: lastName exactly 50 chars is valid
    it('accepts lastName with exactly 50 characters', () => {
        const data = {
            lastName: 'a'.repeat(50),
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(true)
    })

    // TC-F23-04-08: Phone with letters fails
    it('rejects phone containing letters', () => {
        const data = {
            phone: '+1 (212) ABC-5555',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-09: Phone too short — not a country code and < 7 digits
    it('rejects short number that is not a country code', () => {
        const data = {
            phone: '123',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-10: Phone too long (> 20 chars)
    it('rejects phone exceeding 20 characters', () => {
        const data = {
            phone: '+123456789012345678901',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-11: Valid E.164 digits-only phone
    it('accepts valid E.164 digits-only phone', () => {
        const data = {
            phone: '+12125551234',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(true)
    })

    // TC-F23-04-12: Phone without + prefix is rejected (UI always includes country code)
    it('rejects phone without country code prefix', () => {
        const data = {
            phone: '2125551234',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-21: Empty phone string is valid (field is optional)
    it('accepts empty string for phone (user cleared the field)', () => {
        const data = {
            firstName: 'John',
            phone: '',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(true)
    })

    // TC-F23-04-22: Country-code-only is valid (user switched country but typed no number)
    it('accepts country-code-only phone (e.g. +84, +60)', () => {
        expect(profilePatchSchema.safeParse({ phone: '+84' }).success).toBe(true)
        expect(profilePatchSchema.safeParse({ phone: '+60' }).success).toBe(true)
    })

    // TC-F23-04-23: Omitting phone entirely is valid
    it('accepts payload without phone field', () => {
        const data = {
            lastName: 'Doe',
        }
        const result = profilePatchSchema.safeParse(data)
        expect(result.success).toBe(true)
    })
})

describe('passwordChangeSchema', () => {
    // TC-F23-04-13: Valid password change
    it('parses valid password change (Aa1!aaaa)', () => {
        const data = {
            currentPassword: 'OldPass1!',
            newPassword: 'Aa1!aaaa',
        }
        const result = passwordChangeSchema.safeParse(data)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual(data)
        }
    })

    // TC-F23-04-14: Password too short (< 6 chars, GH-2269)
    it('rejects newPassword shorter than 6 characters', () => {
        const data = {
            currentPassword: 'OldPass1!',
            newPassword: 'Aa1!a',
        }
        const result = passwordChangeSchema.safeParse(data)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.map(i => i.message)).toContain('passwordMinLength')
        }
    })

    // TC-F23-04-14: Exactly 6 chars with uppercase + digit is accepted (GH-2269)
    it('accepts newPassword of exactly 6 characters', () => {
        const data = {
            currentPassword: 'OldPass1!',
            newPassword: 'Aa1!aa',
        }
        expect(passwordChangeSchema.safeParse(data).success).toBe(true)
    })

    // TC-F23-04-15: Password missing uppercase fails
    it('rejects newPassword without uppercase letter', () => {
        const data = {
            currentPassword: 'OldPass1!',
            newPassword: 'aa1!aaaa',
        }
        const result = passwordChangeSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-17: Password missing digit fails
    it('rejects newPassword without number', () => {
        const data = {
            currentPassword: 'OldPass1!',
            newPassword: 'Aa!aaaaa',
        }
        const result = passwordChangeSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-19: Missing currentPassword fails
    it('rejects when currentPassword is missing', () => {
        const data = {
            newPassword: 'Aa1!aaaa',
        }
        const result = passwordChangeSchema.safeParse(data)
        expect(result.success).toBe(false)
    })

    // TC-F23-04-20: Empty currentPassword fails
    it('rejects empty currentPassword', () => {
        const data = {
            currentPassword: '',
            newPassword: 'Aa1!aaaa',
        }
        const result = passwordChangeSchema.safeParse(data)
        expect(result.success).toBe(false)
    })
})
