/**
 * TC-F01V-CD — Content delegation to template-composer builders (updated for #2103 A1).
 *
 * buildBlockFromLibrary delegates features/stats/pricing/team/logo-cloud/testimonials/faq to the
 * composer builders, which now read only the merchant FACTS: no curated "Halal Certified",
 * "Dr. Tan Wei Ming", "Bridal Package RM 800", "Patients Treated" and friends.
 */

import { describe, expect, it } from 'vitest'
import { buildBlockFromLibrary } from '@/lib/ai/content-injection'
import { buildGenerationFacts } from '@/lib/ai/generation-facts'

const facts = buildGenerationFacts({
    businessInfo: {
        businessName: 'Dapur Kak Yah',
        products: 'Kek lapis (whole RM65, half RM35), kuih raya box RM48, tempahan birthday from RM120',
        phone: '012-3456789',
        buyingMethods: ['delivery', 'cod'],
        serviceArea: 'Klang Valley',
        shopFacts: 'Started in 2015',
    },
    tenant: { payments: { payment_fpx: true, payment_cod: true } },
})
const ctx = { seed: 42, userBiz: { name: 'Dapur Kak Yah', products: ['Kek lapis', 'kuih raya box', 'tempahan birthday'], facts } }

describe('buildBlockFromLibrary — delegation to template-composer (R-wire)', () => {
    describe('features delegation', () => {
        it('TC-F01V-CD.01 — features are the merchant products, never curated claims', () => {
            const block = buildBlockFromLibrary('features', 'fnb', ctx)
            const features = (block?.features as Array<{ title: string; description: string }>) ?? []
            expect(features.map((f) => f.title)).toEqual(['Kek lapis', 'Kuih raya box', 'Tempahan birthday'])
            expect(features[0]!.description).toBe('RM 65')
            expect(features[2]!.description).toBe('From RM 120')
        })

        it('TC-F01V-CD.02 — restaurant/health/tech features carry no halal, SLA, doctor or insurance claims', () => {
            for (const category of ['restaurant', 'health', 'tech', 'beauty']) {
                const block = buildBlockFromLibrary('features', category, { seed: 1 })
                const text = JSON.stringify(block?.features)
                expect(text, category).not.toMatch(/halal|jakim|grabfood|foodpanda|sla|uptime|soc 2|insurance|dermatolog|doctor/i)
            }
        })

        it('TC-F01V-CD.03 — with nothing listed, features are the claim-free trio', () => {
            const block = buildBlockFromLibrary('features', 'beauty', { seed: 7 })
            const features = (block?.features as Array<{ title: string }>) ?? []
            expect(features.map((f) => f.title)).toEqual(['Tell us what you need', 'Easy to reach', 'Made around you'])
        })
    })

    describe('stats delegation', () => {
        it('TC-F01V-CD.05 — stats are only real facts (year started, products listed)', () => {
            const block = buildBlockFromLibrary('stats', 'health', ctx)
            const stats = (block?.stats as Array<{ value: string; label: string }>) ?? []
            expect(stats).toEqual([
                { value: '2015', label: 'Year started' },
                { value: '3', label: 'Products' },
            ])
        })

        it('TC-F01V-CD.06 — no facts → nothing to inject (no invented numbers)', () => {
            expect(buildBlockFromLibrary('stats', 'restaurant', { seed: 99 })).toBeNull()
        })
    })

    describe('team delegation', () => {
        it('TC-F01V-CD.07 — team is the brand team, no named people', () => {
            const block = buildBlockFromLibrary('team', 'health', ctx)
            const members = (block?.members as Array<{ name: string; role: string }>) ?? []
            expect(members).toEqual([{ name: 'The Dapur Kak Yah team', role: 'Founder' }])
        })
    })

    describe('pricing delegation', () => {
        it('TC-F01V-CD.09 — pricing plans are the merchant priced products', () => {
            const block = buildBlockFromLibrary('pricing', 'beauty', ctx)
            const plans = (block?.plans as Array<{ name: string; price: string }>) ?? []
            expect(plans.map((p) => `${p.name}=${p.price}`)).toEqual([
                'Kek lapis=RM 65',
                'kuih raya box=RM 48',
                'tempahan birthday=From RM 120',
            ])
        })

        it('TC-F01V-CD.11 — no merchant prices → no pricing block is injected', () => {
            expect(buildBlockFromLibrary('pricing', 'travel', { seed: 2 })).toBeNull()
        })
    })

    describe('logo-cloud / testimonials / faq delegation', () => {
        it('TC-F01V-CD.16 — logo-cloud shows only enabled payment methods', () => {
            const block = buildBlockFromLibrary('logo-cloud', 'tech', ctx)
            expect((block?.logos as Array<{ name: string }>).map((l) => l.name)).toEqual(['FPX', 'Cash on delivery'])
        })

        it('TC-F01V-CD.17 — testimonials without real reviews is one invitation card', () => {
            const block = buildBlockFromLibrary('testimonials', 'beauty', ctx)
            const items = block?.testimonials as Array<Record<string, unknown>>
            expect(items).toHaveLength(1)
            expect(items[0]!.quote).toBe('Be the first to review Dapur Kak Yah')
            expect(items[0]!.rating).toBeUndefined()
        })

        it('TC-F01V-CD.18 — faq answers come from facts (contact, offer, how to order, area)', () => {
            const block = buildBlockFromLibrary('faq', 'fnb', ctx)
            const faqs = block?.faqs as Array<{ question: string; answer: string }>
            expect(faqs.map((f) => f.question)).toEqual([
                'How can I contact Dapur Kak Yah?',
                'What does Dapur Kak Yah offer?',
                'How do I order?',
                'Which areas do you serve?',
            ])
            expect(faqs[2]!.answer).toContain('We offer delivery.')
            expect(faqs[2]!.answer).toContain('Accepted payment methods: FPX, Cash on delivery.')
        })

        it('TC-F01V-CD.19 — faq with no facts is not injected', () => {
            expect(buildBlockFromLibrary('faq', 'fnb', { seed: 1, userBiz: { name: 'Solo' } })).toBeNull()
        })
    })

    describe('service-cards delegation', () => {
        it('TC-F01V-CD.12 — service-cards delegates to composer (not generic "Premium Service")', () => {
            const block = buildBlockFromLibrary('service-cards', 'health', {
                seed: 42,
                userBiz: { name: 'Test Clinic', products: [] },
            })
            const services = (block?.services as Array<{ title: string }>) ?? []
            expect(services.length).toBeGreaterThan(0)
            expect(services.every((s) => s.title !== 'Premium Service')).toBe(true)
        })

        it('TC-F01V-CD.13 — service-cards with biz.products emits product-derived services', () => {
            const block = buildBlockFromLibrary('service-cards', 'health', {
                seed: 10,
                userBiz: {
                    name: 'bibi Dental',
                    products: ['Teeth Whitening', 'Dental Implants', 'Orthodontics'],
                },
            })
            const services = (block?.services as Array<{ title: string }>) ?? []
            const titlesText = services.map((s) => s.title.toLowerCase()).join(' ')
            expect(/whitening|implant|orthodont|dental/.test(titlesText)).toBe(true)
        })
    })

    describe('determinism + shape compat', () => {
        it('TC-F01V-CD.14 — same seed + category reproduces same block', () => {
            const a = buildBlockFromLibrary('features', 'health', { seed: 123 })
            const b = buildBlockFromLibrary('features', 'health', { seed: 123 })
            expect(JSON.stringify(a)).toBe(JSON.stringify(b))
        })

        it('TC-F01V-CD.15 — delegated blocks have correct blockType field', () => {
            const types: Record<string, string | undefined> = {}
            for (const bt of ['features', 'stats', 'pricing', 'team', 'service-cards']) {
                types[bt] = buildBlockFromLibrary(bt, 'beauty', ctx)?.blockType as string | undefined
            }
            expect(types).toEqual({
                features: 'features',
                stats: 'stats',
                pricing: 'pricing',
                team: 'team',
                'service-cards': 'service-cards',
            })
        })
    })
})
