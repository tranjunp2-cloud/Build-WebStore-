import { describe, expect, it } from 'vitest'
import { buildTemplateTheme } from '@/lib/ai/template-theme'
import { resolveTheme } from '@/lib/theme/resolve'
import { THEME_ENUMS } from '@/lib/theme/enums'
import { sanitizeTheme } from '@/lib/theme/sanitize-theme'

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

describe('[TC-F07.047] template fonts survive apply', () => {
    it.each([
        ['Inter', 'Lora'], ['Playfair Display', 'Lora'], ['Josefin Sans', 'Karla'], ['Oswald', 'Source Sans 3'], ['Quicksand', 'Nunito Sans'],
    ])('keeps %s / %s', (fontHeading, fontBody) => {
        // Arrange
        const rawTheme = { fontHeading, fontBody }

        // Act
        const theme = buildTemplateTheme(rawTheme)

        // Assert
        expect(theme.fontHeading).toBe(fontHeading)
        expect(theme.fontBody).toBe(fontBody)
    })

    it('renders the template pairing through resolveTheme without the Outfit/Inter fallback', () => {
        // Arrange
        const theme = buildTemplateTheme({ fontHeading: 'Oswald', fontBody: 'Source Sans 3' })

        // Act
        const resolved = resolveTheme(theme as Parameters<typeof resolveTheme>[0])

        // Assert
        expect(resolved.fontHeading).toBe('Oswald')
        expect(resolved.fontBody).toBe('Source Sans 3')
    })
})

describe('[TC-F07.048] template fonts stay inside the Sites enum', () => {
    it('falls back to Outfit/Inter for fonts the editor cannot load', () => {
        // Arrange
        const rawTheme = { fontHeading: 'Helvetica', fontBody: 'Impact' }

        // Act
        const theme = buildTemplateTheme(rawTheme)

        // Assert
        expect(theme.fontHeading).toBe('Outfit')
        expect(theme.fontBody).toBe('Inter')
    })

    it('only emits fonts that sanitizeTheme accepts', () => {
        // Arrange
        const fonts = THEME_ENUMS.fontHeading

        // Act + Assert
        for (const font of fonts) {
            const theme = buildTemplateTheme({ fontHeading: font, fontBody: font })
            expect(sanitizeTheme(theme)).toMatchObject({ fontHeading: font, fontBody: font })
        }
    })
})

describe('[TC-F07.048] font enum migrations cover every theme font', () => {
    it.each(['heading', 'body'])('adds every THEME_FONTS value to the %s enum', (role) => {
        // Arrange
        const { MIGRATIONS } = require('../../../../scripts/db-setup.js') as { MIGRATIONS: { name: string; sql: string }[] }
        const added = new Set(
            MIGRATIONS.filter(m => m.name.startsWith(`enum_sites_theme_font_${role}.`))
                .map(m => /VALUE IF NOT EXISTS '([^']+)'/.exec(m.sql)?.[1]),
        )

        // Act
        const missing = THEME_ENUMS.fontHeading.filter(font => !added.has(font))

        // Assert
        expect(missing).toEqual([])
    })
})
