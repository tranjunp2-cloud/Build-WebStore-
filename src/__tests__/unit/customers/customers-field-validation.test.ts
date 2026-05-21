import { describe, it, expect } from 'vitest'
import { Customers } from '../../../collections/Customers'

describe('Customers Collection Field Validation (TC-F25-009..010)', () => {
    describe('TC-F25-009: Address array maxRows enforcement', () => {
        it('TC-F25-009: Should have maxRows=10 on addresses field', () => {
            // Arrange: find addresses field in Customers config
            const addressesField = Customers.fields.find((f: any) => f.name === 'addresses') as any

            // Assert: field exists and has maxRows set to 10
            expect(addressesField).toBeDefined()
            expect(addressesField.type).toBe('array')
            expect(addressesField.maxRows).toBe(10)
        })

        it('TC-F25-009: Addresses field should have expected sub-fields', () => {
            // Arrange
            const addressesField = Customers.fields.find((f: any) => f.name === 'addresses') as any

            // Assert: all expected address fields are present
            const fieldNames = addressesField.fields.map((f: any) => f.name)
            expect(fieldNames).toContain('label')
            expect(fieldNames).toContain('line1')
            expect(fieldNames).toContain('line2')
            expect(fieldNames).toContain('city')
            expect(fieldNames).toContain('state')
            expect(fieldNames).toContain('postcode')
            expect(fieldNames).toContain('country')
            expect(fieldNames).toContain('isDefault')
        })

        it('TC-F25-009: line1 should be required in addresses', () => {
            // Arrange
            const addressesField = Customers.fields.find((f: any) => f.name === 'addresses') as any
            const line1Field = addressesField.fields.find((f: any) => f.name === 'line1') as any

            // Assert
            expect(line1Field).toBeDefined()
            expect(line1Field.required).toBe(true)
        })

        it('TC-F25-009: country should default to Malaysia', () => {
            // Arrange
            const addressesField = Customers.fields.find((f: any) => f.name === 'addresses') as any
            const countryField = addressesField.fields.find((f: any) => f.name === 'country') as any

            // Assert
            expect(countryField).toBeDefined()
            expect(countryField.defaultValue).toBe('Malaysia')
        })
    })

    describe('TC-F25-010: Rank select enum validation', () => {
        it('TC-F25-010: Should have rank field with correct options', () => {
            // Arrange: find rank field
            const rankField = Customers.fields.find((f: any) => f.name === 'rank') as any

            // Assert: field exists and is select type
            expect(rankField).toBeDefined()
            expect(rankField.type).toBe('select')
        })

        it('TC-F25-010: Rank options should be exactly bronze, silver, gold, vip', () => {
            // Arrange
            const rankField = Customers.fields.find((f: any) => f.name === 'rank') as any

            // Assert: options match expected enum
            const optionValues = rankField.options.map((opt: any) => opt.value)
            expect(optionValues).toEqual(['bronze', 'silver', 'gold', 'vip'])
        })

        it('TC-F25-010: Rank options should have human-readable labels', () => {
            // Arrange
            const rankField = Customers.fields.find((f: any) => f.name === 'rank') as any

            // Assert: labels are properly capitalized
            const options = rankField.options
            expect(options).toContainEqual({ label: 'Bronze', value: 'bronze' })
            expect(options).toContainEqual({ label: 'Silver', value: 'silver' })
            expect(options).toContainEqual({ label: 'Gold', value: 'gold' })
            expect(options).toContainEqual({ label: 'VIP', value: 'vip' })
        })

        it('TC-F25-010: Rank should not be required (optional field)', () => {
            // Arrange
            const rankField = Customers.fields.find((f: any) => f.name === 'rank') as any

            // Assert: not explicitly required
            expect(rankField.required).not.toBe(true)
        })
    })

    describe('Core customer fields', () => {
        it('Should have email field (required, indexed)', () => {
            // Arrange
            const emailField = Customers.fields.find((f: any) => f.name === 'email') as any

            // Assert
            expect(emailField).toBeDefined()
            expect(emailField.type).toBe('email')
            expect(emailField.required).toBe(true)
            expect(emailField.index).toBe(true)
        })

        it('Should have name field (required)', () => {
            // Arrange
            const nameField = Customers.fields.find((f: any) => f.name === 'name') as any

            // Assert
            expect(nameField).toBeDefined()
            expect(nameField.type).toBe('text')
            expect(nameField.required).toBe(true)
        })

        it('Should have tenant relationship (required, indexed)', () => {
            // Arrange
            const tenantField = Customers.fields.find((f: any) => f.name === 'tenant') as any

            // Assert
            expect(tenantField).toBeDefined()
            expect(tenantField.type).toBe('relationship')
            expect(tenantField.relationTo).toBe('tenants')
            expect(tenantField.required).toBe(true)
            expect(tenantField.index).toBe(true)
        })

        it('Should have firstOrderAt field (readonly)', () => {
            // Arrange
            const firstOrderAtField = Customers.fields.find((f: any) => f.name === 'firstOrderAt') as any

            // Assert
            expect(firstOrderAtField).toBeDefined()
            expect(firstOrderAtField.type).toBe('date')
            expect(firstOrderAtField.admin?.readOnly).toBe(true)
        })
    })

    describe('Admin UI configuration', () => {
        it('Should use email as title in admin UI', () => {
            expect(Customers.admin?.useAsTitle).toBe('email')
        })

        it('Should have listSearchableFields configured', () => {
            expect(Customers.admin?.listSearchableFields).toBeDefined()
            expect(Customers.admin?.listSearchableFields).toContain('email')
            expect(Customers.admin?.listSearchableFields).toContain('name')
        })

        it('Should have default columns configured', () => {
            expect(Customers.admin?.defaultColumns).toBeDefined()
            expect(Customers.admin?.defaultColumns).toContain('email')
            expect(Customers.admin?.defaultColumns).toContain('name')
            expect(Customers.admin?.defaultColumns).toContain('rank')
        })
    })
})
