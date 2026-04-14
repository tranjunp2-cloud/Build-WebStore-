import { describe, it, expect } from 'vitest'
import { mergeUserContent } from '@/lib/ai/merge-user-content'

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
