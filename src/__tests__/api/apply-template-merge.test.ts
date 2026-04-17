import { describe, it, expect } from 'vitest'
import { mergeUserContent, type MergeResult } from '@/lib/ai/merge-user-content'

describe('mergeUserContent', () => {
    it('preserves user content fields while applying template structural fields', () => {
        const templateBlocks = [
            { blockType: 'hero', variant: 'split-left', headline: 'Template Title', subheadline: 'Template Sub' },
        ]
        const existingBlocks = [
            { blockType: 'hero', variant: 'centered', headline: 'My Custom Title', subheadline: 'My Custom Sub' },
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks)

        expect(result[0]).toEqual({
            blockType: 'hero',
            variant: 'split-left',          // structural → from template
            headline: 'My Custom Title',     // content → from user
            subheadline: 'My Custom Sub',    // content → from user
        })
    })

    it('handles multiple blocks of the same type (matched by order)', () => {
        const templateBlocks = [
            { blockType: 'hero', variant: 'centered', headline: 'Template Hero 1' },
            { blockType: 'hero', variant: 'fullscreen', headline: 'Template Hero 2' },
        ]
        const existingBlocks = [
            { blockType: 'hero', variant: 'split-left', headline: 'User Hero 1' },
            { blockType: 'hero', variant: 'split-right', headline: 'User Hero 2' },
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks)

        expect(result[0]!.headline).toBe('User Hero 1')
        expect(result[0]!.variant).toBe('centered')       // template structural
        expect(result[1]!.headline).toBe('User Hero 2')
        expect(result[1]!.variant).toBe('fullscreen')      // template structural
    })

    it('uses template defaults when no matching existing block', () => {
        const templateBlocks = [
            { blockType: 'hero', variant: 'centered', headline: 'Template Title' },
            { blockType: 'about', layout: 'image-right', headline: 'About Us' },
        ]
        const existingBlocks = [
            { blockType: 'hero', variant: 'split-left', headline: 'My Title' },
            // no existing about block
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks)

        expect(result[0]!.headline).toBe('My Title')      // merged from user
        expect(result[1]!.headline).toBe('About Us')       // template default (no match)
        expect(result[1]!.layout).toBe('image-right')      // template structural
    })

    it('does not overwrite structural fields (variant/layout/style) with user values', () => {
        const templateBlocks = [
            { blockType: 'about', layout: 'cards', headline: 'Template About' },
        ]
        const existingBlocks = [
            { blockType: 'about', layout: 'image-left', headline: 'User About', body: 'User body text' },
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks)

        expect(result[0]!.layout).toBe('cards')            // structural → from template, NOT user
        expect(result[0]!.headline).toBe('User About')     // content → from user
        expect(result[0]!.body).toBe('User body text')     // content → from user
    })

    it('skips empty/null user content fields (uses template defaults)', () => {
        const templateBlocks = [
            { blockType: 'contact', headline: 'Contact Us', email: 'template@example.com', phone: '+60123456789' },
        ]
        const existingBlocks = [
            { blockType: 'contact', headline: '', email: null, phone: '+60999888777' },
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks)

        expect(result[0]!.headline).toBe('Contact Us')       // user was empty → template default
        expect(result[0]!.email).toBe('template@example.com') // user was null → template default
        expect(result[0]!.phone).toBe('+60999888777')         // user had value → preserved
    })

    it('preserves array content fields (features, testimonials, faqs)', () => {
        const userFeatures = [
            { title: 'Custom Feature 1', description: 'My desc' },
            { title: 'Custom Feature 2', description: 'My desc 2' },
        ]
        const templateBlocks = [
            { blockType: 'features', layout: 'grid-3', headline: 'Template Features', features: [] },
        ]
        const existingBlocks = [
            { blockType: 'features', layout: 'grid-2', headline: 'My Features', features: userFeatures },
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks)

        expect(result[0]!.layout).toBe('grid-3')             // structural → template
        expect(result[0]!.headline).toBe('My Features')      // content → user
        expect(result[0]!.features).toEqual(userFeatures)     // content array → user
    })

    it('handles template blocks with more types than existing blocks', () => {
        const templateBlocks = [
            { blockType: 'hero', variant: 'centered', headline: 'Hero' },
            { blockType: 'about', layout: 'cards', headline: 'About' },
            { blockType: 'faq', headline: 'FAQ' },
        ]
        const existingBlocks = [
            { blockType: 'hero', variant: 'split-left', headline: 'My Hero' },
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks)

        expect(result).toHaveLength(3)
        expect(result[0]!.headline).toBe('My Hero')     // merged
        expect(result[1]!.headline).toBe('About')        // template default
        expect(result[2]!.headline).toBe('FAQ')           // template default
    })

    it('returns template blocks as-is when existingBlocks is empty', () => {
        const templateBlocks = [
            { blockType: 'hero', variant: 'centered', headline: 'Template' },
        ]

        const result = mergeUserContent(templateBlocks, [])

        expect(result).toEqual(templateBlocks)
    })
})

// ── returnDetails: unmatched block detection ──────────────────────────────

describe('mergeUserContent with returnDetails', () => {
    it('backward compatible: returns array when no options', () => {
        const result = mergeUserContent(
            [{ blockType: 'hero', variant: 'centered' }],
            [{ blockType: 'hero', variant: 'split-left' }],
        )
        expect(Array.isArray(result)).toBe(true)
    })

    it('returns MergeResult when returnDetails: true', () => {
        const result = mergeUserContent(
            [{ blockType: 'hero', variant: 'centered' }],
            [{ blockType: 'hero', variant: 'split-left' }],
            { returnDetails: true },
        )
        expect(result).toHaveProperty('mergedBlocks')
        expect(result).toHaveProperty('unmatchedUserBlocks')
    })

    it('BUG REPRO: CTA block added by user is captured as unmatched when template has no CTA', () => {
        // User has: nav, hero, features, CTA (added by user), footer
        const existingBlocks = [
            { blockType: 'navigation', style: 'fixed', logoText: 'My Store' },
            { blockType: 'hero', variant: 'centered', headline: 'Welcome' },
            { blockType: 'features', layout: 'grid-3', headline: 'Features' },
            { blockType: 'cta', variant: 'banner', headline: 'Get Started Now', ctaLabel: 'Sign Up', ctaUrl: '/signup' },
            { blockType: 'footer', logoText: 'My Store', copyrightText: '2026' },
        ]

        // New template has: nav, hero, about, testimonials, footer (NO CTA)
        const templateBlocks = [
            { blockType: 'navigation', style: 'sticky', logoText: 'Template' },
            { blockType: 'hero', variant: 'split-left', headline: 'Template Hero' },
            { blockType: 'about', layout: 'image-right', headline: 'About Us' },
            { blockType: 'testimonials', variant: 'carousel', headline: 'Reviews' },
            { blockType: 'footer', logoText: 'Template', copyrightText: '2026' },
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks, { returnDetails: true }) as MergeResult

        // CTA must be in unmatchedUserBlocks (it's not in the template)
        expect(result.unmatchedUserBlocks).toHaveLength(2) // features + cta
        const unmatchedTypes = result.unmatchedUserBlocks.map(b => b.blockType)
        expect(unmatchedTypes).toContain('cta')
        expect(unmatchedTypes).toContain('features')

        // CTA block data must be fully preserved
        const unmatchedCta = result.unmatchedUserBlocks.find(b => b.blockType === 'cta')
        expect(unmatchedCta).toBeDefined()
        expect(unmatchedCta!.headline).toBe('Get Started Now')
        expect(unmatchedCta!.ctaLabel).toBe('Sign Up')
        expect(unmatchedCta!.ctaUrl).toBe('/signup')

        // mergedBlocks should NOT contain CTA (it's not in template)
        expect(result.mergedBlocks.find(b => b.blockType === 'cta')).toBeUndefined()
    })

    it('CTA block is preserved when BOTH template and user have CTA — user content merged', () => {
        const existingBlocks = [
            { blockType: 'hero', variant: 'centered', headline: 'Welcome' },
            { blockType: 'cta', variant: 'banner', headline: 'My Custom CTA', ctaLabel: 'Buy Now' },
            { blockType: 'footer', logoText: 'Store' },
        ]

        const templateBlocks = [
            { blockType: 'hero', variant: 'split-left', headline: 'Template Hero' },
            { blockType: 'cta', variant: 'inline', headline: 'Template CTA', ctaLabel: 'Get Started' },
            { blockType: 'footer', logoText: 'Template' },
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks, { returnDetails: true }) as MergeResult

        // CTA should be in mergedBlocks (matched by type)
        const mergedCta = result.mergedBlocks.find(b => b.blockType === 'cta')
        expect(mergedCta).toBeDefined()
        // CTA IS in CONTENT_FIELDS now → structural from template, content from user
        expect(mergedCta!.variant).toBe('inline')           // structural → from template
        expect(mergedCta!.headline).toBe('My Custom CTA')   // content → from user
        expect(mergedCta!.ctaLabel).toBe('Buy Now')          // content → from user

        // No unmatched blocks (user CTA matched with template CTA)
        expect(result.unmatchedUserBlocks).toHaveLength(0)
    })

    it('simulates full apply-template flow: unmatched blocks inserted before footer', () => {
        const existingBlocks = [
            { blockType: 'navigation', style: 'fixed', logoText: 'Store' },
            { blockType: 'hero', variant: 'centered', headline: 'Welcome' },
            { blockType: 'cta', variant: 'banner', headline: 'My CTA', ctaLabel: 'Click' },
            { blockType: 'footer', logoText: 'Store' },
        ]

        const templateBlocks = [
            { blockType: 'navigation', style: 'sticky' },
            { blockType: 'hero', variant: 'split-left', headline: 'Template' },
            { blockType: 'about', layout: 'image-right', headline: 'About' },
            { blockType: 'footer', logoText: 'Template' },
        ]

        const { mergedBlocks: merged, unmatchedUserBlocks } = mergeUserContent(
            templateBlocks, existingBlocks, { returnDetails: true },
        ) as MergeResult

        // Simulate what apply-template API does: insert unmatched before footer
        const footerIdx = merged.findIndex(b => b.blockType === 'footer')
        if (footerIdx !== -1 && unmatchedUserBlocks.length > 0) {
            merged.splice(footerIdx, 0, ...unmatchedUserBlocks)
        }

        // Final layout should contain CTA before footer
        const blockTypes = merged.map(b => b.blockType)
        expect(blockTypes).toEqual([
            'navigation', 'hero', 'about',  // from template
            'cta',                            // unmatched user block preserved
            'footer',                         // footer always last
        ])

        // CTA data fully preserved
        const cta = merged.find(b => b.blockType === 'cta')
        expect(cta!.headline).toBe('My CTA')
        expect(cta!.ctaLabel).toBe('Click')
    })

    it('navigation and footer are never reported as unmatched', () => {
        const existingBlocks = [
            { blockType: 'navigation', style: 'fixed', logoText: 'User Nav' },
            { blockType: 'hero', variant: 'centered', headline: 'Hello' },
            { blockType: 'footer', logoText: 'User Footer' },
        ]

        const templateBlocks = [
            { blockType: 'hero', variant: 'split-left', headline: 'Template' },
            // No navigation or footer in template
        ]

        const result = mergeUserContent(templateBlocks, existingBlocks, { returnDetails: true }) as MergeResult

        // Navigation and footer should NOT be in unmatched (they're excluded)
        const unmatchedTypes = result.unmatchedUserBlocks.map(b => b.blockType)
        expect(unmatchedTypes).not.toContain('navigation')
        expect(unmatchedTypes).not.toContain('footer')
    })
})
