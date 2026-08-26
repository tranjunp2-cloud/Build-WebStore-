import { describe, expect, it } from 'vitest'
import {
    getCompatibleSchemaSubtypes,
    isCompatibleSchemaSubtype,
    LOCAL_BUSINESS_SUBTYPE_MAPPING_VERSION,
    reconcileSchemaSubtype,
    SCHEMA_SUBTYPE_OPTIONS,
} from '@/lib/seo/local-business-constants'

describe('[TC-F37-02-29/30] versioned LocalBusiness subtype mapping', () => {
    it('[TC-F37-02-29] returns no options before category and all values come from the versioned registry', () => {
        // Arrange
        const registeredValues = new Set(SCHEMA_SUBTYPE_OPTIONS.map(option => option.value))

        // Act
        const beforeCategory = getCompatibleSchemaSubtypes(undefined)
        const foodOptions = getCompatibleSchemaSubtypes('foodEstablishment')

        // Assert
        expect(LOCAL_BUSINESS_SUBTYPE_MAPPING_VERSION).toBe('f37-local-business-subtypes-2026-07-29')
        expect(beforeCategory).toEqual([])
        expect(foodOptions.map(option => option.value)).toEqual([
            'Restaurant', 'Bakery', 'CafeOrCoffeeShop', 'FastFoodRestaurant',
        ])
        expect(foodOptions.every(option => registeredValues.has(option.value))).toBe(true)
    })

    it('[TC-F37-02-29] auto-selects exactly one option and requires explicit choice for multiple options', () => {
        // Arrange — no setup beyond category inputs.

        // Act
        const soleOption = reconcileSchemaSubtype('restaurant', null)
        const multipleOptions = reconcileSchemaSubtype('foodEstablishment', null)

        // Assert
        expect(soleOption).toBe('Restaurant')
        expect(multipleOptions).toBeNull()
    })

    it('[TC-F37-02-30] preserves only compatible current values and clears stale multi-option pairs', () => {
        // Arrange — compatible and incompatible pairs supplied directly.

        // Act
        const preserved = reconcileSchemaSubtype('foodEstablishment', 'Bakery')
        const cleared = reconcileSchemaSubtype('foodEstablishment', 'Store')

        // Assert
        expect(preserved).toBe('Bakery')
        expect(cleared).toBeNull()
        expect(isCompatibleSchemaSubtype('store', 'Store')).toBe(true)
        expect(isCompatibleSchemaSubtype('store', 'Restaurant')).toBe(false)
    })
})
