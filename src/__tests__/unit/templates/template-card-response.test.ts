import { describe, expect, it } from 'vitest'
import { templateCardResponseSchema } from '@/lib/validations/template-search'

describe('[TC-F07.039] template card swap data', () => {
    const card = { id: 42, name: 'Template', category: ['business'] }

    it('preserves the full raw theme and layout while leaving card display defaults unchanged', () => {
        // Arrange
        const rawTheme = { fontHeading: 'Outfit', borderRadius: 'pill', primaryColor: null }
        const defaultBlocks = [{ blockType: 'hero', headline: 'Template', image: 7 }]
        const templatePages = [{ isHomepage: true, layout: defaultBlocks }]

        // Act
        const result = templateCardResponseSchema.parse({ ...card, defaultTheme: rawTheme, defaultBlocks, templatePages })

        // Assert
        expect(result.defaultTheme).toEqual({ primaryColor: '#3B82F6', colorMode: 'light' })
        expect(result.swapData).toEqual({ defaultTheme: rawTheme, defaultBlocks, templatePages })
    })

    it('does not mark metadata-only search cards as ready to swap', () => {
        // Arrange
        const metadata = { ...card, defaultTheme: { primaryColor: '#123456', colorMode: 'light' } }

        // Act
        const result = templateCardResponseSchema.parse(metadata)

        // Assert
        expect(result).not.toHaveProperty('swapData')
    })

    it('keeps explicit empty full-template data and a null raw theme', () => {
        // Arrange
        const raw = { ...card, defaultTheme: null, defaultBlocks: [], templatePages: null }

        // Act
        const result = templateCardResponseSchema.parse(raw)

        // Assert
        expect(result.swapData).toEqual({ defaultTheme: null, defaultBlocks: [], templatePages: null })
    })

    it('retains explicitly supplied raw swap data instead of deriving it from card colors', () => {
        // Arrange
        const swapData = { defaultTheme: null, defaultBlocks: [{ blockType: 'hero' }] }

        // Act
        const result = templateCardResponseSchema.parse({ ...card, defaultTheme: { colorMode: 'light' }, swapData })

        // Assert
        expect(result.swapData).toEqual(swapData)
    })
})
