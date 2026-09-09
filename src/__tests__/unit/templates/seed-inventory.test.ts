import { describe, expect, it } from 'vitest'
import {
    buildRequiredSeedInventory,
    hasSeedInventoryFailure,
    isManagedSeedTemplate,
} from '@/lib/templates/seed-inventory'
import { composeFromBlueprint } from '@/lib/ai/template-composer'
import { SPORTS_RETAIL_PRESETS } from '@/lib/ai/template-presets-sports-retail'

describe('[TC-F31-001, TC-F31-006] required template seed inventory', () => {
    it('TC-F31-001: preserves every successfully composed preset and seed', () => {
        // Arrange
        const presets = [{ id: 'free' }, { id: 'premium' }]

        // Act
        const inventory = buildRequiredSeedInventory(presets, (preset) => ({
            name: preset.id,
            isPremium: preset.id === 'premium',
        }))

        // Assert
        expect(inventory).toEqual({
            pairs: [
                { preset: presets[0], seed: { name: 'free', isPremium: false } },
                { preset: presets[1], seed: { name: 'premium', isPremium: true } },
            ],
            missingCount: 0,
        })
    })

    it('TC_F07_037: composes both sports-retail presets into the managed inventory', () => {
        const inventory = buildRequiredSeedInventory(SPORTS_RETAIL_PRESETS, composeFromBlueprint)
        expect(inventory.pairs).toHaveLength(2)
        const sportsRetailNames = inventory.pairs
            .filter(({ preset }) => preset.tags.includes('sports'))
            .map(({ seed }) => seed.name)

        expect(inventory.missingCount).toBe(0)
        expect(sportsRetailNames).toEqual(['Activewear Performance', 'Sports Equipment Pro'])
    })

    it('TC-F31-006: reports a missing composition as a failed seed run', () => {
        // Arrange
        const presets = [{ id: 'valid' }, { id: 'invalid' }]

        // Act
        const inventory = buildRequiredSeedInventory(
            presets,
            (preset) => preset.id === 'valid' ? { name: preset.id } : null,
        )

        // Assert
        expect(inventory.pairs).toHaveLength(1)
        expect(inventory.missingCount).toBe(1)
        expect(hasSeedInventoryFailure(0, inventory.missingCount)).toBe(true)
        expect(hasSeedInventoryFailure(1, 0)).toBe(true)
        expect(hasSeedInventoryFailure(0, 0)).toBe(false)
    })

    it('TC-F31-001: only reconciles records stamped by the seed system', () => {
        expect(isManagedSeedTemplate('0123456789abcdef')).toBe(true)
        expect(isManagedSeedTemplate('manual-template')).toBe(false)
        expect(isManagedSeedTemplate(null)).toBe(false)
    })
})
