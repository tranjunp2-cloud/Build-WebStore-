import { describe, it, expect } from 'vitest'
import { generateVariantMatrix, type VariantConfig, type Variant } from '../components/dashboard/VariantsEditor'

describe('generateVariantMatrix', () => {
    it('returns empty array when no configs', () => {
        expect(generateVariantMatrix([], [])).toEqual([])
    })

    it('returns empty array when all configs have empty options', () => {
        expect(generateVariantMatrix([{ name: 'Color', options: [] }], [])).toEqual([])
    })

    it('generates 1D array for single tier', () => {
        const configs: VariantConfig[] = [{ name: 'Color', options: ['Red', 'Blue'] }]
        const result = generateVariantMatrix(configs, [])
        expect(result).toHaveLength(2)
        expect(result[0].name).toBe('Red')
        expect(result[1].name).toBe('Blue')
    })

    it('generates 2D cartesian product for two tiers', () => {
        const configs: VariantConfig[] = [
            { name: 'Color', options: ['Red', 'Blue'] },
            { name: 'Size', options: ['S', 'M'] }
        ]
        const result = generateVariantMatrix(configs, [])
        expect(result).toHaveLength(4)
        expect(result.map(v => v.name)).toEqual([
            'Red - S', 'Red - M', 'Blue - S', 'Blue - M'
        ])
    })

    it('preserves existing variant data', () => {
        const configs: VariantConfig[] = [
            { name: 'Color', options: ['Red', 'Blue'] }
        ]
        const existing: Variant[] = [
            { name: 'Red', sku: 'SKU-RED', price: '100', stock: '5', compareAtPrice: '150' }
        ]
        const result = generateVariantMatrix(configs, existing)
        expect(result[0]).toEqual({ name: 'Red', sku: 'SKU-RED', price: '100', stock: '5', compareAtPrice: '150' })
        expect(result[1]).toEqual({ name: 'Blue', sku: '', price: '', stock: '0', compareAtPrice: '' })
    })
})
