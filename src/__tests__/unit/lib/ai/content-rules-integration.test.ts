/**
 * Integration Tests: Content Rules wired into AI sanitizer + template composer
 * Phase 04 — TC-F01D-04.08, TC-F01D-04.09
 * Convention: docs/TEST_CONVENTION.md
 *
 * Verifies that validateBlockContent is actually called downstream and
 * merges fixes into the sanitized / composed output.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getAllMeta: () => [],
        has: vi.fn((type: string) => ['hero', 'navigation', 'features', 'testimonials', 'footer', 'contact'].includes(type)),
        getBlockMeta: vi.fn((type: string) => {
            const metas: Record<string, { type: string; variants: string[]; defaultVariant: string }> = {
                hero: { type: 'hero', variants: ['centered', 'split-left', 'fullscreen', 'gradient'], defaultVariant: 'centered' },
                navigation: { type: 'navigation', variants: ['simple', 'centered'], defaultVariant: 'simple' },
                features: { type: 'features', variants: ['grid-3', 'grid-4', 'list'], defaultVariant: 'grid-3' },
                testimonials: { type: 'testimonials', variants: ['cards', 'carousel', 'simple'], defaultVariant: 'cards' },
                footer: { type: 'footer', variants: ['simple', 'minimal', 'centered-stack', 'dark-gradient'], defaultVariant: 'simple' },
                contact: { type: 'contact', variants: ['form', 'split'], defaultVariant: 'form' },
            }
            return metas[type] ?? null
        }),
        validate: vi.fn((_type: string, data: unknown) => ({ success: true, data })),
    },
}))
vi.mock('@/lib/ai/system-prompt', () => ({
    buildSystemPrompt: () => '',
    buildUserPrompt: () => '',
}))
vi.mock('@/lib/ai/generate-blocks', () => ({
    generateBlocks: () => ({
        siteName: 'Test',
        siteType: 'business',
        blocks: [],
        seo: { title: '', description: '' },
        theme: { primaryColor: '#000', secondaryColor: '#000', fontHeading: 'Inter', fontBody: 'Lora', colorMode: 'light' },
    }),
}))

import { sanitizeBlockData } from '@/lib/ai/openai-generator'

beforeEach(() => {
    vi.restoreAllMocks()
})

describe('[TC-F01D-04.08] sanitizeBlockData wires content-rules validation', () => {
    it('auto-fixes "Submit" CTA in hero block (en)', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const raw = {
            blockType: 'hero',
            variant: 'centered',
            headline: 'Book a Free Consultation',
            ctaButtons: [{ label: 'Submit', url: '/' }],
        }
        const result = sanitizeBlockData(raw, undefined, 'en')
        const btns = result.ctaButtons as unknown as Array<Record<string, unknown>>
        expect(btns[0]!.label).toBe('Get Started')
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[design-quality] hero CTA "Submit" blocked'),
        )
    })

    it('auto-fixes Vietnamese blocked CTA when language=vi', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const raw = {
            blockType: 'hero',
            variant: 'centered',
            headline: 'Nhà hàng Việt Nam ngon nhất',
            ctaButtons: [{ label: 'Gửi', url: '/' }],
        }
        const result = sanitizeBlockData(raw, undefined, 'vi')
        const btns = result.ctaButtons as unknown as Array<Record<string, unknown>>
        expect(btns[0]!.label).toBe('Đăng ký ngay')
    })

    it('truncates hero headline over 10 words', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const raw = {
            blockType: 'hero',
            variant: 'centered',
            headline: 'This is a ridiculously long headline that clearly exceeds the maximum ten word limit strictly',
        }
        const result = sanitizeBlockData(raw, undefined, 'en')
        const wordCount = String(result.headline).trim().split(/\s+/).length
        expect(wordCount).toBeLessThanOrEqual(10)
    })

    it('fixes navigation CTA "Click Here"', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const raw = {
            blockType: 'navigation',
            variant: 'simple',
            links: [{ label: 'Home', url: '/' }],
            ctaButton: { label: 'Click Here', url: '/', show: true },
        }
        const result = sanitizeBlockData(raw, undefined, 'en')
        const btn = result.ctaButton as Record<string, unknown>
        expect(btn.label).toBe('Get Started')
    })

    it('passes valid content unchanged', () => {
        const raw = {
            blockType: 'hero',
            variant: 'centered',
            headline: 'Build Your Dream Website Today',
            ctaButtons: [{ label: 'Book Now', url: '/' }],
        }
        const result = sanitizeBlockData(raw, undefined, 'en')
        expect(result.headline).toBe('Build Your Dream Website Today')
        const btns = result.ctaButtons as unknown as Array<Record<string, unknown>>
        expect(btns[0]!.label).toBe('Book Now')
    })

    it('does not throw on blocks without blockType', () => {
        const raw = { headline: 'No type' }
        expect(() => sanitizeBlockData(raw, undefined, 'en')).not.toThrow()
    })

    it('defaults language to en when omitted', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const raw = {
            blockType: 'hero',
            variant: 'centered',
            headline: 'Great Title',
            ctaButtons: [{ label: 'Submit', url: '/' }],
        }
        const result = sanitizeBlockData(raw)
        const btns = result.ctaButtons as unknown as Array<Record<string, unknown>>
        expect(btns[0]!.label).toBe('Get Started')
    })
})

describe('[TC-F01D-04.09] Template path applyContentValidation smoke test', () => {
    it('applyContentValidation fixes blocked CTA on a template-composer-shaped block', async () => {
        // Smoke test — composeFromBlueprint has heavy deps (15+ builders,
        // getCategoryContent, etc.). Rather than mock the whole universe,
        // verify that the SAME `applyContentValidation` helper wired into
        // buildBlockFromSpec's call site actually fixes blocks the composer
        // would produce. This is the contract between the two modules.
        const { applyContentValidation } = await import('@/lib/ai/content-rules')

        // Simulate what buildHero might emit if content/*.ts had a blocked label.
        const heroFromComposer = {
            blockType: 'hero',
            variant: 'centered',
            headline: 'Our Professional Services',
            subheadline: 'Discover quality solutions for your business today.',
            ctaButtons: [
                { label: 'Learn More', url: '/about', style: 'primary' },
            ],
        }

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const validated = applyContentValidation(heroFromComposer, 'en')

        // Auto-fixed
        const btns = validated.ctaButtons as unknown as Array<Record<string, unknown>>
        expect(btns[0]!.label).not.toBe('Learn More')
        expect(btns[0]!.label).toBe('Get Started')
        // Preserved other fields
        expect(btns[0]!.url).toBe('/about')
        expect(btns[0]!.style).toBe('primary')
        // Input never mutated
        expect((heroFromComposer.ctaButtons as unknown as Array<Record<string, unknown>>)[0]!.label).toBe('Learn More')
        expect(warnSpy).toHaveBeenCalled()
    })

    it('template path validation handles missing blockType gracefully', async () => {
        const { applyContentValidation } = await import('@/lib/ai/content-rules')
        const block = { headline: 'No type field' }
        const result = applyContentValidation(block, 'en')
        expect(result).toEqual(block)
    })
})
