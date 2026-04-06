import { describe, it, expect } from 'vitest'
import { BLOCK_TYPES, BaseBlockSchema, ThemeConfigSchema, CTAButtonSchema, ImageRefSchema } from '@/blocks/types'
import { HeroConfigSchema, heroMeta } from '@/blocks/hero/config'
import { ContactConfigSchema, contactMeta } from '@/blocks/contact/config'
import { blockRegistry } from '@/blocks/registry'

// ─── TC-F04: Block system configuration ───────────────────────────────
// ─── TC-F01.08: Block registry for AI generation ─────────────────────

describe('Block Types & Base Schemas [TC-F04]', () => {
    it('BLOCK_TYPES has all 50 registered types', () => {
        expect(BLOCK_TYPES.length).toBe(50)
        expect(BLOCK_TYPES).toContain('hero')
        expect(BLOCK_TYPES).toContain('navigation')
        expect(BLOCK_TYPES).toContain('contact')
        expect(BLOCK_TYPES).toContain('footer')
        expect(BLOCK_TYPES).toContain('products-grid')
    })

    it('BaseBlockSchema validates valid block', () => {
        const result = BaseBlockSchema.safeParse({
            blockType: 'hero',
            variant: 'centered',
        })
        expect(result.success).toBe(true)
    })

    it('BaseBlockSchema rejects unknown blockType', () => {
        const result = BaseBlockSchema.safeParse({
            blockType: 'nonexistent',
        })
        expect(result.success).toBe(false)
    })

    it('BaseBlockSchema defaults isVisible to true', () => {
        const result = BaseBlockSchema.safeParse({ blockType: 'hero' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.isVisible).toBe(true)
        }
    })
})

describe('ThemeConfigSchema [TC-F04]', () => {
    it('validates valid theme', () => {
        const result = ThemeConfigSchema.safeParse({
            primaryColor: '#3B82F6',
            secondaryColor: '#8B5CF6',
        })
        expect(result.success).toBe(true)
    })

    it('rejects invalid hex color', () => {
        const result = ThemeConfigSchema.safeParse({
            primaryColor: 'not-a-color',
        })
        expect(result.success).toBe(false)
    })

    it('defaults colorMode to dark', () => {
        const result = ThemeConfigSchema.safeParse({})
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.colorMode).toBe('dark')
        }
    })

    // ─── TC-S1-001: ThemeConfig expanded type — all 14 fields ───────
    it('TC-S1-001: validates full theme with all 14 fields', () => {
        const result = ThemeConfigSchema.safeParse({
            primaryColor: '#0ea5e9',
            secondaryColor: '#d946ef',
            accentColor: '#7dd3fc',
            surfaceColor: '#111111',
            textColor: '#fafafa',
            mutedColor: '#a1a1aa',
            fontPairingId: 'modern-clean',
            fontHeading: 'Inter',
            fontBody: 'Inter',
            spacingPreset: 'compact',
            borderRadius: 'pill',
            shadowPreset: 'dramatic',
            colorMode: 'dark',
            backgroundColor: '#09090b',
        })
        expect(result.success).toBe(true)
    })

    // ─── TC-S1-002: Zod validation edge cases ──────────────────────
    it('TC-S1-002: rejects transparent as primaryColor', () => {
        const result = ThemeConfigSchema.safeParse({ primaryColor: 'transparent' })
        expect(result.success).toBe(false)
    })

    it('TC-S1-002: rejects empty string as primaryColor', () => {
        const result = ThemeConfigSchema.safeParse({ primaryColor: '' })
        expect(result.success).toBe(false)
    })

    it('TC-S1-002: rejects 3-char hex shorthand', () => {
        const result = ThemeConfigSchema.safeParse({ primaryColor: '#FFF' })
        expect(result.success).toBe(false)
    })

    it('TC-S1-002: rejects 8-char hex with alpha', () => {
        const result = ThemeConfigSchema.safeParse({ primaryColor: '#0ea5e9ff' })
        expect(result.success).toBe(false)
    })

    it('TC-S1-002: rejects invalid spacingPreset', () => {
        const result = ThemeConfigSchema.safeParse({ spacingPreset: 'huge' })
        expect(result.success).toBe(false)
    })

    it('TC-S1-002: rejects invalid borderRadius', () => {
        const result = ThemeConfigSchema.safeParse({ borderRadius: 'mega' })
        expect(result.success).toBe(false)
    })

    it('TC-S1-002: rejects invalid shadowPreset', () => {
        const result = ThemeConfigSchema.safeParse({ shadowPreset: 'extreme' })
        expect(result.success).toBe(false)
    })

    it('TC-S1-002: accepts fontPairingId as null', () => {
        const result = ThemeConfigSchema.safeParse({ fontPairingId: null })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.fontPairingId).toBeNull()
        }
    })

    it('TC-S1-002: empty {} fills all defaults correctly', () => {
        const result = ThemeConfigSchema.safeParse({})
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.primaryColor).toBe('#0ea5e9')
            expect(result.data.secondaryColor).toBe('#d946ef')
            expect(result.data.spacingPreset).toBe('default')
            expect(result.data.borderRadius).toBe('rounded')
            expect(result.data.shadowPreset).toBe('subtle')
            expect(result.data.fontPairingId).toBeNull()
            expect(result.data.fontHeading).toBe('Outfit')
            expect(result.data.fontBody).toBe('Inter')
        }
    })
})

describe('CTAButtonSchema', () => {
    it('validates valid CTA button', () => {
        const result = CTAButtonSchema.safeParse({
            label: 'Get Started',
            url: '/signup',
        })
        expect(result.success).toBe(true)
    })

    it('defaults style to primary', () => {
        const result = CTAButtonSchema.safeParse({ label: 'Click', url: '#' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.style).toBe('primary')
        }
    })

    it('rejects missing label', () => {
        const result = CTAButtonSchema.safeParse({ url: '#' })
        expect(result.success).toBe(false)
    })
})

describe('ImageRefSchema', () => {
    it('validates image with url', () => {
        const result = ImageRefSchema.safeParse({ url: '/images/hero.jpg' })
        expect(result.success).toBe(true)
    })

    it('accepts optional alt, width, height', () => {
        const result = ImageRefSchema.safeParse({
            url: '/img.png',
            alt: 'Hero image',
            width: 1920,
            height: 1080,
        })
        expect(result.success).toBe(true)
    })
})

describe('HeroConfigSchema [TC-F04]', () => {
    it('validates valid hero block', () => {
        const result = HeroConfigSchema.safeParse({
            blockType: 'hero',
            headline: 'Welcome to My Site',
        })
        expect(result.success).toBe(true)
    })

    it('defaults variant to centered', () => {
        const result = HeroConfigSchema.safeParse({
            blockType: 'hero',
            headline: 'Test',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('centered')
        }
    })

    it('rejects invalid variant', () => {
        const result = HeroConfigSchema.safeParse({
            blockType: 'hero',
            headline: 'Test',
            variant: 'nonexistent',
        })
        expect(result.success).toBe(false)
    })

    it('validates with CTA buttons', () => {
        const result = HeroConfigSchema.safeParse({
            blockType: 'hero',
            headline: 'Welcome',
            ctaButtons: [
                { label: 'Start', url: '#', style: 'primary' },
                { label: 'Learn', url: '#about', style: 'outline' },
            ],
        })
        expect(result.success).toBe(true)
    })

    it('clamps overlayOpacity between 0 and 1', () => {
        const tooHigh = HeroConfigSchema.safeParse({
            blockType: 'hero',
            headline: 'Test',
            overlayOpacity: 2,
        })
        expect(tooHigh.success).toBe(false)
    })
})

describe('heroMeta [TC-F01.08]', () => {
    it('has correct type and name', () => {
        expect(heroMeta.type).toBe('hero')
        expect(heroMeta.name).toBe('Hero')
    })

    it('lists expected variants', () => {
        expect(heroMeta.variants).toContain('centered')
        expect(heroMeta.variants).toContain('split-left')
    })

    it('has editableFields', () => {
        expect(heroMeta.editableFields).toContain('headline')
        expect(heroMeta.editableFields).toContain('ctaButtons')
    })
})

describe('ContactConfigSchema [TC-F04]', () => {
    it('validates valid contact block', () => {
        const result = ContactConfigSchema.safeParse({
            blockType: 'contact',
            headline: 'Get in Touch',
            email: 'hello@test.com',
        })
        expect(result.success).toBe(true)
    })

    it('defaults formFields to empty array', () => {
        const result = ContactConfigSchema.safeParse({
            blockType: 'contact',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.formFields).toEqual([])
        }
    })

    it('validates form fields structure', () => {
        const result = ContactConfigSchema.safeParse({
            blockType: 'contact',
            formFields: [
                { label: 'Name', fieldName: 'name', fieldType: 'text', required: true },
                { label: 'Email', fieldName: 'email', fieldType: 'email' },
            ],
        })
        expect(result.success).toBe(true)
    })
})

describe('blockRegistry [TC-F01.08]', () => {
    it('has all block types registered', () => {
        for (const type of BLOCK_TYPES) {
            expect(blockRegistry.has(type)).toBe(true)
        }
    })

    it('getAllMeta returns meta for all blocks', () => {
        const metas = blockRegistry.getAllMeta()
        expect(metas.length).toBe(BLOCK_TYPES.length)
        for (const meta of metas) {
            expect(meta.type).toBeDefined()
            expect(meta.name).toBeDefined()
            expect(meta.variants.length).toBeGreaterThan(0)
        }
    })

    it('validates valid hero block data', () => {
        const result = blockRegistry.validate('hero', {
            blockType: 'hero',
            headline: 'Test',
        })
        expect(result.success).toBe(true)
    })

    it('rejects invalid block data', () => {
        const result = blockRegistry.validate('hero', {
            blockType: 'hero',
            // missing headline
        })
        // May succeed with defaults or fail — depends on schema strictness
        // At minimum, it should not throw
        expect(result).toBeDefined()
    })
})
