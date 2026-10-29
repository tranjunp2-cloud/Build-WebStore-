/**
 * TC-AIAUD-160..161 — #2103 A1 follow-up: library sample businesses ("Farah Glow
 * Studio", Bangsar address, +60 numbers, glow@farahstudio.my …) must never reach a
 * merchant's generated site. Identity + contact come from the merchant / FACTS or
 * stay empty. (TC-AIAUD-162 lives in generate-blocks.test.ts.)
 */

import { describe, it, expect } from 'vitest'
import { categoryMap } from '@/lib/ai/content'
import type { BusinessSample } from '@/lib/ai/content'
import { withoutLibraryIdentity } from '@/lib/ai/library-identity'
import { postAISwapStep } from '@/lib/ai/post-ai-swap'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import { buildBlockFromLibrary } from '@/lib/ai/content-injection'

/** The contact form's phone input placeholder; some samples reuse it as their number. */
const FORM_PLACEHOLDER_PHONE = '+60 12-345 6789'

/** Strings that identify a library sample business: name, phone, email, address. */
function libraryMarkers(): string[] {
    const out = new Set<string>()
    for (const pack of Object.values(categoryMap)) {
        for (const b of pack.businesses) {
            for (const v of [b.name, b.phone, b.email, b.address]) if (v && v !== FORM_PLACEHOLDER_PHONE) out.add(v)
        }
    }
    return [...out]
}

function leaks(value: unknown): string[] {
    const json = JSON.stringify(value)
    return libraryMarkers().filter((m) => json.includes(m))
}

const genericBlocks = [
    { blockType: 'hero', headline: 'Welcome', subheadline: 'Quality service' },
    { blockType: 'features', headline: 'Why Choose Us', features: [{ title: 'Quality Service', description: 'Exceptional quality in every interaction' }] },
    { blockType: 'about', headline: 'About Us', body: 'We are a team of dedicated professionals' },
    { blockType: 'cta', headline: 'Ready to get started?', subheadline: 'Contact us today' },
    { blockType: 'faq', headline: 'FAQ', items: [{ question: 'What do you offer?', answer: 'A wide range of services' }] },
]

describe('TC-AIAUD-160: withoutLibraryIdentity', () => {
    const sample = categoryMap.beauty!.businesses[0]!

    it('blanks identity + contact of the library sample when the merchant gave nothing', () => {
        const biz = withoutLibraryIdentity(sample, {})
        expect(biz).toMatchObject({ name: '', tagline: '', description: '', address: '', phone: '', email: '' })
        expect(biz.heroHeadline).toBe(sample.heroHeadline)
    })

    it('merchant values win and undefined override keys do not resurrect the sample', () => {
        const biz = withoutLibraryIdentity(sample, { name: 'Acme', phone: undefined })
        expect(biz.name).toBe('Acme')
        expect(biz.phone).toBe('')
    })

    it('falls back to FACTS brand, description and contact', () => {
        const facts = {
            brand: 'Kedai Mira',
            description: 'Handmade soaps',
            contact: { phone: '+60 11-1111 1111', email: 'mira@kedai.my', address: '1 Jalan Satu' },
        } as unknown as NonNullable<BusinessSample['facts']>
        const biz = withoutLibraryIdentity(sample, { facts })
        expect(biz).toMatchObject({
            name: 'Kedai Mira',
            description: 'Handmade soaps',
            phone: '+60 11-1111 1111',
            email: 'mira@kedai.my',
            address: '1 Jalan Satu',
        })
    })
})

describe('TC-AIAUD-160: post-ai-swap never injects library identity or contact', () => {
    it.each(Object.keys(categoryMap))('%s: empty merchant partial, several seeds', (category) => {
        for (const seed of [0, 1, 7, 99999]) {
            const { blocks } = postAISwapStep(genericBlocks, {}, category, undefined, seed)
            expect(leaks(blocks)).toEqual([])
        }
    })

    it('keeps merchant name and uses neutral name when missing', () => {
        const withName = postAISwapStep(genericBlocks, { name: 'Acme Studio' }, 'beauty', undefined, 3)
        expect(JSON.stringify(withName.blocks)).toContain('Acme Studio')
        expect(leaks(withName.blocks)).toEqual([])
    })
})

describe('TC-AIAUD-161: template, fallback and gap-fill paths', () => {
    const prompts: Array<[string, string]> = [
        ['Luxury spa salon with skincare treatments', 'beauty'],
        ['Fine dining restaurant with seasonal menu', 'restaurant'],
        ['Online store selling handmade boutique jewelry', 'ecommerce'],
        ['I want a site for my dental clinic', 'health'],
        ['Yoga studio membership signup', 'fitness'],
        ['Vietnamese coffee cafe brand online', 'fnb'],
    ]

    it.each(prompts)('composeFallbackResult with only a name: %s', (prompt) => {
        const result = composeFallbackResult(prompt, 11, 'en', { businessName: 'Acme Co' } as never)
        expect(result).not.toBeNull()
        expect(leaks(result)).toEqual([])
        expect(JSON.stringify(result)).toContain('Acme Co')
    })

    it('composeFallbackResult keeps merchant contact verbatim', () => {
        const result = composeFallbackResult('Luxury spa salon', 5, 'en', {
            businessName: 'Acme Co',
            phone: '+60 12-222 3333',
            email: 'hi@acme.my',
            address: '9 Jalan Acme, Ipoh',
        } as never)
        const json = JSON.stringify(result)
        expect(json).toContain('+60 12-222 3333')
        expect(json).toContain('hi@acme.my')
        expect(leaks(result)).toEqual([])
    })

    it.each(['contact', 'footer', 'hero', 'about', 'cta', 'features', 'testimonials', 'faq'])(
        'gap-fill %s with a merchant that gave only a name',
        (blockType) => {
            for (const category of ['beauty', 'restaurant', 'health']) {
                const block = buildBlockFromLibrary(blockType, category, {
                    businessName: 'Acme Co',
                    userBiz: { name: 'Acme Co' },
                    seed: 4,
                })
                expect(leaks(block)).toEqual([])
            }
        },
    )
})
