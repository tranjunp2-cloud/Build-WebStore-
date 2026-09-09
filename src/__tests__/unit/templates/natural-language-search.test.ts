import { describe, expect, it } from 'vitest'
import {
    detectTemplateSearchLocale,
    searchTemplates,
    templateSearchCategories,
} from '@/lib/templates/natural-language-search'
import { TEMPLATE_PRESETS } from '@/lib/ai/template-definitions'

const templates = [
    {
        id: 'sport-shop',
        name: 'Activewear Performance',
        category: ['ecommerce'],
        tags: [{ tag: 'sports' }, { tag: 'activewear' }],
    },
    {
        id: 'sport-equipment',
        name: 'Sports Equipment Pro',
        category: ['ecommerce'],
        tags: [{ tag: 'fitness' }, { tag: 'equipment' }],
    },
    { id: 'gym', name: 'Fitness Studio', category: ['fitness'] },
    { id: 'fashion', name: 'Fashion Boutique', category: ['ecommerce', 'creative'] },
    { id: 'beauty', name: 'Beauty Studio', category: ['beauty'] },
]

describe('[TC_F07_037] natural-language template search', () => {
    it('uses the concrete industry as the database prefilter', () => {
        expect(templateSearchCategories('mẫu cho shop thể thao')).toEqual(['ecommerce', 'fitness'])
        expect(templateSearchCategories('kedai baju')).toEqual(['ecommerce'])
        expect(templateSearchCategories('cua hang quan ao')).toEqual(['ecommerce'])
        expect(templateSearchCategories('galactic astronaut')).toEqual([])
    })

    it('TC_F07_037: treats shop as the required site type for a Vietnamese sports-shop query', () => {
        // Arrange / Act
        const results = searchTemplates(templates, 'Mẫu cho Shop Thể Thao')

        // Assert
        expect(results.map((template) => template.id)).toEqual(['sport-shop', 'sport-equipment'])
    })

    it('TC_F07_037: ships at least two managed sports-retail presets', () => {
        // Arrange
        const sportsSignals = new Set(['sport', 'sports', 'fitness', 'activewear', 'equipment'])

        // Act
        const sportsRetailPresets = TEMPLATE_PRESETS.filter((preset) => (
            preset.category === 'ecommerce' && preset.tags.some((tag) => sportsSignals.has(tag))
        ))

        // Assert
        expect(sportsRetailPresets.length).toBeGreaterThanOrEqual(2)
        expect(new Set(sportsRetailPresets.map(({ name }) => name)).size).toBe(sportsRetailPresets.length)

        const rankedInventory = searchTemplates(
            TEMPLATE_PRESETS.map((preset) => ({
                ...preset,
                tags: preset.tags.map((tag) => ({ tag })),
            })),
            'mẫu cho shop thể thao',
        )
        expect(rankedInventory).toHaveLength(sportsRetailPresets.length)
        expect(rankedInventory.every((preset) => sportsRetailPresets.some(({ id }) => id === preset.id))).toBe(true)
    })

    it('TC_F07_037: maps Bahasa Melayu clothing-shop intent to ecommerce templates', () => {
        // Arrange / Act
        const results = searchTemplates(templates, 'kedai baju moden')

        // Assert
        expect(results.map((template) => template.id)).toEqual([
            'sport-shop',
            'fashion',
        ])
    })

    it.each(['kedai baju', 'clothing shop', 'cửa hàng quần áo'])('keeps clothing intent for %s across the shipped inventory', (query) => {
        const results = searchTemplates(TEMPLATE_PRESETS.map((preset) => ({
            ...preset, tags: preset.tags.map((tag) => ({ tag })),
        })), query)
        expect(results.length).toBeGreaterThanOrEqual(2)
        expect(results.every((template) => template.category === 'ecommerce')).toBe(true)
        expect(results.map(({ name }) => name)).not.toContain('Sports Equipment Pro')
        expect(results.every((template) => /fashion|clothing|boutique|apparel|activewear|streetwear/i.test(
            [template.name, template.description, ...template.tags.map(({ tag }) => tag)].join(' '),
        ))).toBe(true)
    })

    it('TC_F07_037: excludes fitness studios from a sports-shop query', () => {
        // Arrange
        const categoryOnlyTemplates = [
            ...templates.filter((template) => !template.id.startsWith('sport-')),
            { id: 'yoga', name: 'Yoga Studio', category: ['fitness'] },
        ]

        // Act
        const results = searchTemplates(categoryOnlyTemplates, 'mẫu cho shop thể thao')

        // Assert
        expect(results.map((template) => template.id)).toEqual([])
    })

    it('detects the query language independently from the editor language', () => {
        expect(detectTemplateSearchLocale('phi hành gia vũ trụ', 'en')).toBe('vi')
        expect(detectTemplateSearchLocale('kedai baju moden', 'en')).toBe('ms')
        expect(detectTemplateSearchLocale('sports shop', 'ms')).toBe('en')
    })

    it('TC_F07_038: returns no result for an unrelated phrase', () => {
        // Arrange / Act
        const results = searchTemplates(templates, 'phi hành gia vũ trụ')

        // Assert
        expect(results).toEqual([])
    })

    it('TC_F07_038: supports an exact template-name search without a known category intent', () => {
        // Arrange / Act
        const results = searchTemplates(templates, 'activewear')

        // Assert
        expect(results.map((template) => template.id)).toEqual(['sport-shop', 'sport-equipment'])
    })

    it('TC_F07_038: normalizes punctuation in exact-name search', () => {
        const results = searchTemplates(templates, 'activewear!')

        expect(results.map((template) => template.id)).toEqual(['sport-shop', 'sport-equipment'])
    })

    it('TC_F07_037: does not fabricate an unrelated second result', () => {
        // Arrange
        const unrelatedInventory = [
            { id: 'activewear', name: 'Activewear Store', category: ['fitness'] },
            { id: 'restaurant', name: 'Bistro', category: ['restaurant'] },
        ]

        // Act
        const results = searchTemplates(unrelatedInventory, 'activewear')

        // Assert
        expect(results).toEqual([])
    })

    it('TC_F07_037: returns empty when the entire live inventory has only one match', () => {
        const results = searchTemplates(
            [{ id: 'activewear', name: 'Activewear Store', category: ['fitness'] }],
            'activewear',
        )

        expect(results).toEqual([])
    })

    it('TC_F07_037: recognises English plural industry terms', () => {
        // Arrange
        const pluralTemplates = [
            { id: 'restaurant', name: 'Bistro', category: ['restaurant'] },
            { id: 'restaurant-2', name: 'Dining Room', category: ['restaurant'] },
            { id: 'shop', name: 'Storefront', category: ['ecommerce'] },
            { id: 'shop-2', name: 'Online Boutique', category: ['ecommerce'] },
            { id: 'hotel', name: 'Seaside Hotel', category: ['travel'] },
            { id: 'hotel-2', name: 'Mountain Resort', category: ['travel'] },
        ]

        // Act / Assert
        expect(searchTemplates(pluralTemplates, 'restaurants').map((template) => template.id)).toEqual(['restaurant', 'restaurant-2'])
        expect(searchTemplates(pluralTemplates, 'shops').map((template) => template.id)).toEqual(['shop', 'shop-2'])
        expect(searchTemplates(pluralTemplates, 'hotels').map((template) => template.id)).toEqual(['hotel', 'hotel-2'])
    })

    it('TC_F07_038: does not treat the English pronoun "it" as a tech category', () => {
        // Arrange / Act
        const results = searchTemplates([{ id: 'tech', name: 'Software Company', category: ['tech'] }], 'make it beautiful')

        // Assert
        expect(results).toEqual([])
    })
})
