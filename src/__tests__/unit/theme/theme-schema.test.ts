import { describe, it, expect } from 'vitest'
import { ThemeConfigSchema } from '@/blocks/types'

// ── TC-S1-001: ThemeConfig expanded type definition — Zod validation ────────
describe('[TC-S1-001] ThemeConfigSchema validates complete ThemeConfig', () => {
    it('validates a complete ThemeConfig with all fields', () => {
        // Arrange
        const completeConfig = {
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            accentColor: '#7dd3fc',
            surfaceColor: '#111111',
            textColor: '#fafafa',
            mutedColor: '#a1a1aa',
            backgroundColor: '#09090b',
            fontPairingId: 'editorial',
            fontHeading: 'Playfair Display',
            fontBody: 'Lora',
            colorMode: 'dark',
            spacingPreset: 'default',
            borderRadius: 'rounded',
            shadowPreset: 'subtle',
        }

        // Act
        const result = ThemeConfigSchema.safeParse(completeConfig)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.primaryColor).toBe('#0ea5e9')
            expect(result.data.spacingPreset).toBe('default')
            expect(result.data.borderRadius).toBe('rounded')
            expect(result.data.shadowPreset).toBe('subtle')
        }
    })
})

// ── TC-S1-002: ThemeConfig Zod schema — minimal v1 config + invalid inputs ──
describe('[TC-S1-002] ThemeConfigSchema validates minimal v1 config and rejects invalid inputs', () => {
    it('validates minimal v1 config (only primary + secondary) with defaults', () => {
        // Arrange
        const minimalConfig = {
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
        }

        // Act
        const result = ThemeConfigSchema.safeParse(minimalConfig)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.spacingPreset).toBe('default')
            expect(result.data.borderRadius).toBe('rounded')
            expect(result.data.shadowPreset).toBe('subtle')
            expect(result.data.fontPairingId).toBeNull()
            expect(result.data.fontHeading).toBe('Outfit')
            expect(result.data.fontBody).toBe('Inter')
            expect(result.data.colorMode).toBe('dark')
        }
    })

    it('rejects invalid hex color for primaryColor', () => {
        // Arrange
        const invalidConfig = {
            primaryColor: 'not-a-color',
            secondaryColor: '#d946ef',
        }

        // Act
        const result = ThemeConfigSchema.safeParse(invalidConfig)

        // Assert
        expect(result.success).toBe(false)
    })

    it('rejects empty string for primaryColor', () => {
        // Arrange
        const invalidConfig = {
            primaryColor: '',
            secondaryColor: '#d946ef',
        }

        // Act
        const result = ThemeConfigSchema.safeParse(invalidConfig)

        // Assert
        expect(result.success).toBe(false)
    })

    it('rejects "transparent" as primaryColor', () => {
        // Arrange
        const invalidConfig = {
            primaryColor: 'transparent',
            secondaryColor: '#d946ef',
        }

        // Act
        const result = ThemeConfigSchema.safeParse(invalidConfig)

        // Assert
        expect(result.success).toBe(false)
    })

    it('rejects invalid spacingPreset value', () => {
        // Arrange
        const invalidConfig = {
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            spacingPreset: 'huge',
        }

        // Act
        const result = ThemeConfigSchema.safeParse(invalidConfig)

        // Assert
        expect(result.success).toBe(false)
    })

    it('rejects invalid borderRadius value', () => {
        // Arrange
        const invalidConfig = {
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            borderRadius: 'mega',
        }

        // Act
        const result = ThemeConfigSchema.safeParse(invalidConfig)

        // Assert
        expect(result.success).toBe(false)
    })

    it('rejects invalid shadowPreset value', () => {
        // Arrange
        const invalidConfig = {
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            shadowPreset: 'ultra',
        }

        // Act
        const result = ThemeConfigSchema.safeParse(invalidConfig)

        // Assert
        expect(result.success).toBe(false)
    })

    it('accepts fontPairingId=null as valid', () => {
        // Arrange
        const config = {
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            fontPairingId: null,
        }

        // Act
        const result = ThemeConfigSchema.safeParse(config)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.fontPairingId).toBeNull()
        }
    })

    it('validates all valid spacingPreset values', () => {
        const presets = ['compact', 'default', 'relaxed'] as const
        for (const preset of presets) {
            const result = ThemeConfigSchema.safeParse({
                primaryColor: '#0ea5e9',
                secondaryColor: '#d946ef',
                spacingPreset: preset,
            })
            expect(result.success).toBe(true)
        }
    })

    it('validates all valid borderRadius values', () => {
        const radii = ['sharp', 'subtle', 'rounded', 'soft', 'pill'] as const
        for (const radius of radii) {
            const result = ThemeConfigSchema.safeParse({
                primaryColor: '#0ea5e9',
                secondaryColor: '#d946ef',
                borderRadius: radius,
            })
            expect(result.success).toBe(true)
        }
    })

    it('validates all valid shadowPreset values', () => {
        const shadows = ['none', 'subtle', 'medium', 'dramatic'] as const
        for (const shadow of shadows) {
            const result = ThemeConfigSchema.safeParse({
                primaryColor: '#0ea5e9',
                secondaryColor: '#d946ef',
                shadowPreset: shadow,
            })
            expect(result.success).toBe(true)
        }
    })
})
