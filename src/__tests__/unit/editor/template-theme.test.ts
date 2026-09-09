import { describe, expect, it } from 'vitest'
import { buildTemplateTheme } from '@/lib/ai/template-theme'

describe('[TC-F07.039] canonical template theme', () => {
    it('fills missing required fields without retaining unrelated custom values', () => {
        // Arrange
        const rawTheme = { primaryColor: '#123456', customCss: 'unused' }

        // Act
        const theme = buildTemplateTheme(rawTheme)

        // Assert
        expect(theme).toEqual({
            primaryColor: '#123456', secondaryColor: '#d946ef',
            fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark',
        })
        expect(rawTheme).toEqual({ primaryColor: '#123456', customCss: 'unused' })
    })

    it('uses the API fallbacks for invalid enums and omits invalid optional enums', () => {
        // Arrange
        const rawTheme = {
            fontHeading: 'Unknown', fontBody: 'Unknown', colorMode: 'auto',
            borderRadius: 'invalid', spacingPreset: 'invalid', shadowPreset: 'invalid',
        }

        // Act
        const theme = buildTemplateTheme(rawTheme)

        // Assert
        expect(theme).toEqual({
            primaryColor: '#0ea5e9', secondaryColor: '#d946ef',
            fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark',
        })
    })

    it('retains all supported explicit theme values', () => {
        // Arrange
        const rawTheme = {
            primaryColor: '#123456', secondaryColor: '#abcdef',
            fontHeading: 'Playfair Display', fontBody: 'Lato', colorMode: 'light',
            backgroundColor: '#ffffff', accentColor: '#ff0000', surfaceColor: '#eeeeee',
            textColor: '#000000', mutedColor: '#888888',
            borderRadius: 'pill', spacingPreset: 'relaxed', shadowPreset: 'dramatic',
        }

        // Act
        const theme = buildTemplateTheme(rawTheme)

        // Assert
        expect(theme).toEqual(rawTheme)
    })

    it.each([undefined, null])('uses canonical defaults for absent theme %s', (rawTheme) => {
        // Arrange — no template theme configured

        // Act
        const theme = buildTemplateTheme(rawTheme)

        // Assert
        expect(theme).toEqual({
            primaryColor: '#0ea5e9', secondaryColor: '#d946ef',
            fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark',
        })
    })
})
